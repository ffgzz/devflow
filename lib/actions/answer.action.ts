"use server";

import ROUTES from "@/constants/routes";
import Answer, { IAnswerDoc } from "@/database/answer.model";
import Question from "@/database/question.model";
import Vote from "@/database/vote.model";
import {
  recordContentInteraction,
  rollbackVoteInteractionsForTargets,
} from "@/lib/dal/interaction";
import {
  createNotification,
  deleteNotificationEvent,
  deleteNotificationsForAnswer,
} from "@/lib/dal/notification";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import action from "../handlers/action";
import handleError from "../handlers/error";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../http-errors";
import {
  AnswerServerSchema,
  DeleteAnswerSchema,
  GetAnswersSchema,
  SetAnswerAcceptanceSchema,
} from "../validations";

export async function createAnswer(
  params: CreateAnswerParams,
): Promise<ActionResponse<IAnswerDoc>> {
  const validationResult = await action({
    params,
    schema: AnswerServerSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId, content } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  if (!userId) {
    return handleError(new UnauthorizedError()) as ErrorResponse;
  }

  const session = await mongoose.startSession();
  let createdAnswer: IAnswerDoc | null = null;

  try {
    await session.withTransaction(async () => {
      const question = await Question.findById(questionId).session(session);
      if (!question) throw new NotFoundError("Question");

      const [answer] = await Answer.create(
        [{ content, question: questionId, author: userId }],
        { session },
      );
      if (!answer) {
        throw new Error("Failed to create answer");
      }
      createdAnswer = answer;

      // 创建回答成功后，我们需要将对应问题的 answers 字段加 1，以保持数据的一致性。
      question.answers += 1;
      await question.save({ session });

      // Notifications are user-visible business data, so they belong in the
      // same transaction as the answer and answer count. The helper skips a
      // notification when someone answers their own question.
      await createNotification(
        {
          type: "answer_created",
          recipientId: question.author,
          actorId: userId,
          questionId,
          answerId: answer._id,
        },
        session,
      );

      await recordContentInteraction(
        {
          action: "post",
          targetId: answer._id.toString(),
          targetType: "answer",
          userId,
        },
        session,
      );
    });

    if (!createdAnswer) {
      throw new Error("Answer transaction did not return a result");
    }

    // 这里调用 revalidatePath 来重新验证问题详情页的缓存，以便新创建的回答能够立即显示在页面上。
    revalidatePath(ROUTES.QUESTION(questionId));

    return {
      success: true,
      data: JSON.parse(JSON.stringify(createdAnswer)),
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

export async function getAnswers(
  params: GetAnswersParams,
): Promise<
  ActionResponse<{ answers: Answer[]; isNext: boolean; totalAnswers: number }>
> {
  const validationResult = await action({
    params,
    schema: GetAnswersSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const {
    questionId,
    page = 1,
    pageSize = 10,
    filter,
    highlightedAnswerId,
  } = validationResult.params;
  const skip = (page - 1) * pageSize;

  let sortCriteria: Record<string, mongoose.SortOrder> = {};
  switch (filter) {
    case "latest":
      sortCriteria = { createdAt: -1 };
      break;
    case "oldest":
      sortCriteria = { createdAt: 1 };
      break;
    case "popular":
      sortCriteria = { upvotes: -1 };
      break;
    default:
      sortCriteria = { createdAt: -1 };
      break;
  }

  try {
    const totalAnswers = await Answer.countDocuments({ question: questionId });
    const highlightedAnswer = highlightedAnswerId
      ? await Answer.findOne({
          _id: highlightedAnswerId,
          question: questionId,
        }).populate("author", "_id name image")
      : null;
    const pageAnswers = await Answer.find({ question: questionId })
      .populate("author", "_id name image")
      .sort(sortCriteria)
      .skip(skip)
      .limit(pageSize);
    const highlightedId = highlightedAnswer?._id.toString();
    const answers = highlightedAnswer
      ? [
          highlightedAnswer,
          ...pageAnswers.filter(
            (answer) => answer._id.toString() !== highlightedId,
          ),
        ]
      : pageAnswers;

    return {
      success: true,
      data: {
        answers: JSON.parse(JSON.stringify(answers)),
        // A target outside the normal page is an extra deep-link preview. It
        // must not consume a slot or shift the regular pagination boundary.
        isNext: skip + pageAnswers.length < totalAnswers,
        totalAnswers,
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

// 设置答案采纳状态的函数，只有问题的作者才能设置答案为采纳状态
export async function setAnswerAcceptance(
  params: SetAnswerAcceptanceParams,
): Promise<ActionResponse<{ acceptedAnswerId: string | null }>> {
  const validationResult = await action({
    params,
    schema: SetAnswerAcceptanceSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId, answerId, accepted } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  if (!userId) {
    return handleError(new UnauthorizedError()) as ErrorResponse;
  }

  const session = await mongoose.startSession();
  let acceptedAnswerId: string | null = null;

  try {
    await session.withTransaction(async () => {
      const question = await Question.findById(questionId).session(session);
      if (!question) throw new NotFoundError("Question");

      // 前端是否显示按钮不能作为权限依据，必须用数据库中的问题作者再校验一次。
      if (question.author.toString() !== userId) {
        throw new ForbiddenError(
          "Only the question author can accept an answer",
        );
      }

      // 同时使用回答 ID 和问题 ID 查询，防止把其他问题的回答采纳进来。
      const answer = await Answer.findOne({
        _id: answerId,
        question: questionId,
      })
        .select("_id author")
        .session(session);

      if (!answer) throw new NotFoundError("Answer");

      const currentAcceptedAnswerId =
        question.acceptedAnswer?.toString() ?? null;

      if (accepted) {
        // 显式设置为目标回答，重复请求不会把它反向取消。
        if (currentAcceptedAnswerId !== answerId) {
          if (currentAcceptedAnswerId) {
            await deleteNotificationEvent(
              "answer_accepted",
              currentAcceptedAnswerId,
              session,
            );
          }
          question.acceptedAnswer = answer._id;
          await question.save({ session });
        }

        // Upsert by the deterministic event key, so retries repair a missing
        // notification without creating duplicates.
        await createNotification(
          {
            type: "answer_accepted",
            recipientId: answer.author,
            actorId: userId,
            questionId,
            answerId: answer._id,
          },
          session,
        );
        acceptedAnswerId = answerId;
        return;
      }

      // 旧页面发出的取消请求只能取消它看到的那条回答，不能误清空新采纳的回答。
      if (currentAcceptedAnswerId === answerId) {
        question.acceptedAnswer = null;
        await question.save({ session });
        await deleteNotificationEvent("answer_accepted", answerId, session);
        acceptedAnswerId = null;
        return;
      }

      acceptedAnswerId = currentAcceptedAnswerId;
    });

    revalidatePath(ROUTES.QUESTION(questionId));

    return { success: true, data: { acceptedAnswerId } };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

// 删除答案的函数，只有答案的作者才能删除自己的答案
export async function deleteAnswer(
  params: DeleteAnswerParams,
): Promise<ActionResponse> {
  const validationResult = await action({
    params,
    schema: DeleteAnswerSchema,
    // 必须登录才能执行删除
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { answerId } = validationResult.params;
  const { user } = validationResult.session!;
  const userId = user?.id;

  if (!userId) {
    return handleError(new UnauthorizedError()) as ErrorResponse;
  }

  const session = await mongoose.startSession();
  let questionId: string | null = null;

  try {
    await session.withTransaction(async () => {
      const answer = await Answer.findById(answerId).session(session);
      if (!answer) throw new NotFoundError("Answer");

      // 必须是自己的答案才能删除，不能删除别人的答案。
      if (answer.author.toString() !== userId) {
        throw new ForbiddenError("You're not allowed to delete this answer");
      }

      const question = await Question.findById(answer.question).session(
        session,
      );
      if (!question) throw new NotFoundError("Question");

      questionId = question._id.toString();
      question.answers = Math.max(0, question.answers - 1);

      // 如果删除的正是已采纳回答，在同一事务中清空引用，避免留下悬空 ID。
      if (question.acceptedAnswer?.toString() === answerId) {
        question.acceptedAnswer = null;
      }

      await question.save({ session });
      await rollbackVoteInteractionsForTargets(
        [
          {
            targetId: answerId,
            targetType: "answer",
            authorId: answer.author.toString(),
          },
        ],
        session,
      );
      await Vote.deleteMany({ id: answerId, type: "answer" }).session(session);
      await deleteNotificationsForAnswer(answerId, session);

      const deletion = await Answer.deleteOne({ _id: answerId }).session(
        session,
      );
      if (deletion.deletedCount !== 1) {
        throw new Error("Failed to delete answer");
      }

      await recordContentInteraction(
        {
          action: "delete",
          targetId: answerId,
          targetType: "answer",
          userId,
        },
        session,
      );
    });

    if (!questionId) throw new NotFoundError("Question");

    revalidatePath(ROUTES.QUESTION(questionId));
    revalidatePath(ROUTES.PROFILE(userId));

    return { success: true };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}
