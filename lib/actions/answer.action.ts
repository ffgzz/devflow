"use server";

import ROUTES from "@/constants/routes";
import Answer, { IAnswerDoc } from "@/database/answer.model";
import Question from "@/database/question.model";
import Vote from "@/database/vote.model";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import action from "../handlers/action";
import handleError from "../handlers/error";
import {
  AnswerServerSchema,
  DeleteAnswerSchema,
  GetAnswersSchema,
} from "../validations";
import { createInteraction } from "./interaction.action";

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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const question = await Question.findById(questionId).session(session);
    if (!question) {
      throw new Error("Question not found");
    }

    const [answer] = await Answer.create(
      [{ content, question: questionId, author: userId }],
      { session },
    );
    if (!answer) {
      throw new Error("Failed to create answer");
    }

    // 创建回答成功后，我们需要将对应问题的 answers 字段加 1，以保持数据的一致性。
    question.answers += 1;
    await question.save({ session });

    // 创建回答后，我们还想记录这个操作，以便后续在用户的个人资料页展示用户的活动记录。
    // 这里我们使用了 Next.js 的 after 函数，它接受一个异步函数作为参数，这个函数会在当前请求完成后执行。我们在这个函数里调用 createInteraction 来创建一条新的交互记录，记录用户创建了一个回答的操作。
    after(async () => {
      await createInteraction({
        action: "post",
        actionId: answer._id.toString(),
        actionTarget: "answer",
        authorId: userId as string,
      });
    });

    await session.commitTransaction();
    // 这里调用 revalidatePath 来重新验证问题详情页的缓存，以便新创建的回答能够立即显示在页面上。
    revalidatePath(ROUTES.QUESTION(questionId));

    return { success: true, data: JSON.parse(JSON.stringify(answer)) };
  } catch (error) {
    await session.abortTransaction();
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
    query,
    filter,
    sort,
  } = validationResult.params;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

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
    const answers = await Answer.find({
      question: questionId,
    })
      // populate 是 Mongoose 用来把 ObjectId 关联字段替换成真实文档数据的方法。
      // 它能工作的前提是你的 schema 里有 ref
      .populate("author", "_id name image")
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);

    return {
      success: true,
      data: {
        answers: JSON.parse(JSON.stringify(answers)),
        isNext: skip + answers.length < totalAnswers,
        totalAnswers,
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
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

  try {
    const answer = await Answer.findById(answerId);
    if (!answer) throw new Error("Answer not found");
    // 必须是自己的答案才能删除，不能删除别人的答案
    if (answer.author.toString() !== user?.id) {
      throw new Error("You're not allowed to delete this answer");
    }
    // 先把对应问题的 answers 字段减 1，以保持数据的一致性。
    await Question.findByIdAndUpdate(
      answer.question,
      { $inc: { answers: -1 } },
      { new: true },
    );

    // 然后删除这个答案，同时也删除与这个答案相关的投票记录，以保持数据的整洁。
    await Vote.deleteMany({ id: answerId, type: "answer" });
    await Answer.findByIdAndDelete(answerId);

    // 删除答案后，我们还想记录这个操作，以便后续在用户的个人资料页展示用户的活动记录。
    // 这里我们使用了 Next.js 的 after 函数，它接受一个异步函数作为参数，这个函数会在当前请求完成后执行。我们在这个函数里调用 createInteraction 来创建一条新的交互记录，记录用户删除了一个回答的操作。
    after(async () => {
      await createInteraction({
        action: "delete",
        actionId: answerId,
        actionTarget: "answer",
        authorId: user?.id as string,
      });
    });

    revalidatePath(`/profile/${user?.id}`);

    return { success: true };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}
