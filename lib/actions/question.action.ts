"use server";

import ROUTES from "@/constants/routes";
import Answer from "@/database/answer.model";
import Collection from "@/database/collection.model";
import Question, { IQuestionDoc } from "@/database/question.model";
import RecommendationFeedback from "@/database/recommendation-feedback.model";
import TagQuestion from "@/database/tag-question.model";
import Tag, { ITagDoc } from "@/database/tag.model";
import Vote from "@/database/vote.model";
import {
  recordContentInteraction,
  rollbackVoteInteractionsForTargets,
} from "@/lib/dal/interaction";
import { deleteNotificationsForQuestion } from "@/lib/dal/notification";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import action from "../handlers/action";
import handleError from "../handlers/error";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../http-errors";
import { dbConnect } from "../mongoose";
import { escapeRegex } from "../utils";
import { buildQuestionSearchTerms } from "../search/question-search-terms.mjs";
import {
  AskQuestionSchema,
  DeleteQuestionSchema,
  EditQuestionSchema,
  GetQuestionSchema,
} from "../validations";

export async function createQuestion(
  params: CreateQuestionParams,
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: AskQuestionSchema,
    // 只有登陆之后才能提问
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { title, content, tags } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  if (!userId) {
    return handleError(new UnauthorizedError()) as ErrorResponse;
  }

  // 开启事务
  // startSession 是 mongoose 提供的一个方法，用于创建一个新的会话（session）。
  // 会话是 MongoDB 中的一种机制，用于在多个操作之间保持一致性和原子性。通过使用会话，可以确保在执行一系列相关操作时，如果其中任何一个操作失败，整个事务都会回滚，从而保持数据的完整性。
  const session = await mongoose.startSession();
  let createdQuestion: IQuestionDoc | null = null;

  try {
    await session.withTransaction(async () => {
      // 创建问题
      const [question] = await Question.create(
        [
          {
            title,
            content,
            author: userId,
            searchTerms: buildQuestionSearchTerms(title, content),
          },
        ],
        {
          session,
        },
      );

      if (!question) {
        throw new Error("Failed to create question");
      }

      const tagIds: mongoose.Types.ObjectId[] = [];
      const tagQuestionDocuments = [];

      // 创建 tag 或者把已有 tag 的 questions 数量 +1
      // 把传入的 tags 数组中的每个 tag 都进行处理，确保它们在数据库中存在，并且更新它们的 questions 数量
      for (const tag of tags) {
        // 找到某个 tag，如果存在就给它的 questions 数量 +1；如果不存在就创建这个 tag，并把 questions 设为 1
        // findOneAndUpdate(查询条件, 更新内容, 配置选项)
        const existigTag = await Tag.findOneAndUpdate(
          {
            name: { $regex: new RegExp(`^${escapeRegex(tag)}$`, "i") },
          },
          // $setOnInsert 是 MongoDB 的一个更新操作符，用于在执行 upsert 操作时，如果没有找到符合条件的文档，就创建一个新的文档，并将指定的字段设置为给定的值
          // $inc 是 MongoDB 的一个更新操作符，用于对指定字段的值进行递增或递减操作。在这里，$inc: { questions: 1 } 表示将 questions 字段的值增加 1。
          { $setOnInsert: { name: tag }, $inc: { questions: 1 } },
          // upsert: true 表示如果没有找到符合条件的文档，就创建一个新的文档；
          // new: true 表示返回更新后的文档而不是原始文档
          { upsert: true, new: true, session },
        ).session(session);

        tagIds.push(existigTag._id);
        tagQuestionDocuments.push({
          tag: existigTag._id,
          question: question._id,
        });
      }
      // 将 question 和 tag 关联起来，插入到 TagQuestion 集合中
      await TagQuestion.insertMany(tagQuestionDocuments, { session });
      // 给刚创建的问题 Question 添加标签 ID
      await Question.findByIdAndUpdate(
        question._id,
        // $push 表示：往数组字段里追加内容。
        // $each 表示：将 tagIds 数组中的每个元素都 push 到 tags 字段的数组中。
        { $push: { tags: { $each: tagIds } } },
        { session },
      );

      await recordContentInteraction(
        {
          action: "post",
          targetId: question._id.toString(),
          targetType: "question",
          userId,
        },
        session,
      );

      createdQuestion = question;
    });

    if (!createdQuestion) {
      throw new Error("Question transaction did not return a result");
    }

    revalidatePath(ROUTES.HOME);

    return {
      success: true,
      // 是为了把 Mongoose 文档变成 Next.js 可以安全返回/传递的普通 JSON 对象。
      data: JSON.parse(JSON.stringify(createdQuestion)),
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  } finally {
    // 结束这次 MongoDB session，释放资源
    await session.endSession();
  }
}

// 编辑问题的流程和创建问题类似，也是一个事务，先验证输入和权限，然后更新问题的标题和内容，最后处理标签的添加和删除。
export async function editQuestion(
  params: EditQuestionParams,
): Promise<ActionResponse<IQuestionDoc>> {
  const validationResult = await action({
    params,
    schema: EditQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { title, content, tags, questionId } = validationResult.params!;
  const userId = validationResult.session?.user?.id;

  if (!userId) {
    return handleError(new UnauthorizedError()) as ErrorResponse;
  }

  const session = await mongoose.startSession();
  let updatedQuestion: IQuestionDoc | null = null;

  try {
    await session.withTransaction(async () => {
      // 首先根据 questionId 找到这个问题，并且用 populate("tags") 把它关联的标签信息也查询出来。这样我们就可以拿到这个问题当前有哪些标签了。
      // populate 是 Mongoose 提供的一个方法，用于在查询文档时自动替换指定字段的 ObjectId 为对应的文档内容。在这里，populate("tags") 表示在查询 Question 文档时，自动将 tags 字段中的 ObjectId 替换为对应的 Tag 文档内容。这样我们就可以直接访问 question.tags 来获取这个问题关联的标签信息了，而不需要再额外查询一次 Tag 集合。
      const question = await Question.findById(questionId)
        .populate("tags")
        .session(session);
      if (!question) throw new NotFoundError("Question");
      // 检查一下这个问题的 author 字段（也就是提问者的 ID）和当前用户的 ID 是否一样，如果不一样就说明这个用户没有权限编辑这个问题，我们就抛出一个错误。这里我们把 question.author 转成字符串来比较，因为它是一个 ObjectId 对象，而 userId 是一个字符串。
      if (question.author.toString() !== userId) {
        throw new ForbiddenError("You're not allowed to edit this question");
      }
      // 如果用户修改了问题的标题或者内容，我们就更新它们。这里我们先检查一下新的标题和内容是否和原来的不一样，如果不一样才去更新，这样可以避免不必要的数据库写操作。
      if (question.title !== title || question.content !== content) {
        question.title = title;
        question.content = content;
      }
      question.searchTerms = buildQuestionSearchTerms(title, content);

      // 处理标签的添加和删除。我们先比较一下用户提交的 tags 和数据库里这个问题当前的 tags，找出需要添加的标签和需要删除的标签。
      const tagsToAdd = tags.filter(
        (tag) =>
          !question.tags.some(
            (t: ITagDoc) => t.name.toLowerCase() === tag.toLowerCase(),
          ),
      );
      // 需要删除的标签是指那些在数据库里这个问题当前的 tags 里有，但是用户提交的 tags 里没有的标签。我们通过 filter 方法来找出这些标签，条件是：对于 question.tags 里的每个 tag，如果在用户提交的 tags 里找不到一个名字和它一样（不区分大小写）的标签，那么这个 tag 就是需要删除的标签。
      const tagsToRemove = question.tags.filter(
        (tag: ITagDoc) =>
          !tags.some((t) => t.toLowerCase() === tag.name.toLowerCase()),
      );

      // 添加新标签
      const newTagDocuments = [];
      if (tagsToAdd.length > 0) {
        for (const tag of tagsToAdd) {
          // 对于每个需要添加的标签，我们先检查一下数据库里是否已经有这个标签了（不区分大小写）。如果有了，我们就把它的 questions 数量 +1；如果没有，我们就创建一个新的标签，并把 questions 设为 1。无论哪种情况，我们都把这个标签和问题的关联关系记录下来，等会儿一起插入到 TagQuestion 集合里。
          const newTag = await Tag.findOneAndUpdate(
            {
              name: {
                $regex: `^${escapeRegex(tag)}$`,
                $options: "i",
              },
            },
            { $setOnInsert: { name: tag }, $inc: { questions: 1 } },
            { upsert: true, new: true, session },
          );

          if (newTag) {
            newTagDocuments.push({ tag: newTag._id, question: questionId });
            question.tags.push(newTag._id);
          }
        }
      }

      // 移除标签
      if (tagsToRemove.length > 0) {
        const tagIdsToRemove = tagsToRemove.map((tag: ITagDoc) => tag._id);
        // 对于每个需要删除的标签，我们把它的 questions 数量 -1
        await Tag.updateMany(
          { _id: { $in: tagIdsToRemove } },
          { $inc: { questions: -1 } },
          { session },
        );
        // 然后我们需要把这些标签和问题的关联关系从 TagQuestion 集合里删除掉。由于一个问题可能关联多个标签，一个标签也可能关联多个问题，所以我们在 TagQuestion 集合里是通过 questionId 和 tagId 来建立它们之间的关系的。当我们要删除某个标签和问题的关联关系时，我们就需要找到所有满足 questionId 和 tagId 在 tagIdsToRemove 里的 TagQuestion 文档，然后把它们删除掉。
        await TagQuestion.deleteMany(
          { tag: { $in: tagIdsToRemove }, question: questionId },
          { session },
        );
        // 最后我们还需要把这个问题的 tags 字段里对应的标签 ID 删除掉，这样才能保持数据的一致性。由于 question.tags 是一个数组，我们可以使用 filter 方法来过滤掉那些需要删除的标签 ID，留下那些不需要删除的标签 ID。
        question.tags = question.tags.filter(
          (tag: mongoose.Types.ObjectId) =>
            !tagIdsToRemove.some((id: mongoose.Types.ObjectId) =>
              id.equals(tag._id),
            ),
        );
      }

      // 插入新的标签和问题的关联关系
      if (newTagDocuments.length > 0) {
        await TagQuestion.insertMany(newTagDocuments, { session });
      }
      // 把更新后的问题保存到数据库里。由于我们之前对 question 对象做了一些修改（比如更新了标题、内容和标签），所以我们需要调用 question.save() 方法来把这些修改保存到数据库里。这里我们也传入了 session 参数，确保这个保存操作也是在同一个事务里进行的。
      await question.save({ session });

      updatedQuestion = question;
    });

    if (!updatedQuestion) {
      throw new Error("Question transaction did not return a result");
    }

    revalidatePath(ROUTES.QUESTION(questionId));
    revalidatePath(ROUTES.HOME);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedQuestion)),
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

// 获取单个问题详情
export async function getQuestion(
  params: GetQuestionParams,
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: GetQuestionSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params;

  try {
    const question = await Question.findById(questionId)
      .populate("tags")
      .populate("author", "_id name image")
      .lean();

    if (!question) {
      throw new Error("Question not found");
    }

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

// 用于右侧的热门问题列表
export const getHotQuestions = async (): Promise<
  ActionResponse<Question[]>
> => {
  try {
    await dbConnect();

    const questions = await Question.find()
      .sort({ views: -1, upvotes: -1 })
      .limit(5);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(questions)),
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};

// 删除问题的函数，只有问题的作者才能删除自己的问题
export async function deleteQuestion(
  params: DeleteQuestionParams,
): Promise<ActionResponse> {
  const validationResult = await action({
    params,
    schema: DeleteQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params;
  const { user } = validationResult.session!;
  const userId = user?.id;

  if (!userId) {
    return handleError(new UnauthorizedError()) as ErrorResponse;
  }

  const session = await mongoose.startSession();

  try {
    // 删除一个问题会同时影响回答、投票、声望、收藏、标签和通知。
    // withTransaction 在并发写冲突时会自动重试，并保证这些变化一起成功或一起回滚。
    await session.withTransaction(async () => {
      const question = await Question.findById(questionId).session(session);
      if (!question) throw new NotFoundError("Question");

      if (question.author.toString() !== userId) {
        throw new ForbiddenError("You're not allowed to delete this question");
      }

      const answers = await Answer.find({ question: questionId }).session(
        session,
      );
      const voteTargets = [
        {
          targetId: questionId,
          targetType: "question" as const,
          authorId: question.author.toString(),
        },
        ...answers.map((answer) => ({
          targetId: answer._id.toString(),
          targetType: "answer" as const,
          authorId: answer.author.toString(),
        })),
      ];

      // Vote 必须在回滚声望之后删除，因为回滚需要读取每一条真实投票。
      await rollbackVoteInteractionsForTargets(voteTargets, session);

      await Collection.deleteMany({ question: questionId }).session(session);
      await RecommendationFeedback.deleteMany({ question: questionId }).session(
        session,
      );
      await TagQuestion.deleteMany({ question: questionId }).session(session);

      if (question.tags.length > 0) {
        await Tag.updateMany(
          { _id: { $in: question.tags } },
          { $inc: { questions: -1 } },
          { session },
        );
      }

      await Vote.deleteMany({
        $or: [
          { id: questionId, type: "question" },
          {
            id: { $in: answers.map((answer) => answer._id) },
            type: "answer",
          },
        ],
      }).session(session);

      if (answers.length > 0) {
        await Answer.deleteMany({ question: questionId }).session(session);

        // 子回答也属于当前内容状态；随问题删除时撤销其发布声望。
        for (const answer of answers) {
          await recordContentInteraction(
            {
              action: "delete",
              targetId: answer._id.toString(),
              targetType: "answer",
              userId: answer.author.toString(),
            },
            session,
          );
        }
      }

      await deleteNotificationsForQuestion(questionId, session);
      const deletion = await Question.deleteOne({ _id: questionId }).session(
        session,
      );
      if (deletion.deletedCount !== 1) {
        throw new Error("Failed to delete question");
      }

      await recordContentInteraction(
        {
          action: "delete",
          targetId: questionId,
          targetType: "question",
          userId,
        },
        session,
      );
    });
    // revalidatePath 是 Next.js 提供的一个函数，用于在服务器端重新验证指定路径的数据。
    // 当我们在服务器端执行某些操作（比如删除了一个问题）之后，我们可能需要让客户端知道这个操作已经完成了，以便它可以更新页面上的数据。通过调用 revalidatePath(`/profile/${user?.id}`)，
    // 我们告诉 Next.js 重新验证这个用户个人主页的数据，这样当用户刷新个人主页或者访问个人主页时，就会看到最新的数据了。
    revalidatePath(`/profile/${userId}`);

    return { success: true };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}
