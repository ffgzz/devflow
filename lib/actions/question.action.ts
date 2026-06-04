"use server";

import { auth } from "@/auth";
import Answer from "@/database/answer.model";
import Collection from "@/database/collection.model";
import Interaction from "@/database/interaction.model";
import Question, { IQuestionDoc } from "@/database/question.model";
import TagQuestion from "@/database/tag-question.model";
import Tag, { ITagDoc } from "@/database/tag.model";
import Vote from "@/database/vote.model";
import mongoose, { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import action from "../handlers/action";
import handleError from "../handlers/error";
import { dbConnect } from "../mongoose";
import {
  AskQuestionSchema,
  DeleteQuestionSchema,
  EditQuestionSchema,
  GetQuestionSchema,
  IncrementViewsSchema,
  PaginatedSearchParamsSchema,
} from "../validations";
import { createInteraction } from "./interaction.action";

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

  // 开启事务
  // startSession 是 mongoose 提供的一个方法，用于创建一个新的会话（session）。
  // 会话是 MongoDB 中的一种机制，用于在多个操作之间保持一致性和原子性。通过使用会话，可以确保在执行一系列相关操作时，如果其中任何一个操作失败，整个事务都会回滚，从而保持数据的完整性。
  const session = await mongoose.startSession();
  // startTransaction 是会话对象提供的一个方法，用于开始一个新的事务。当调用 startTransaction 方法时，MongoDB 会将后续的操作视为一个事务的一部分，直到调用 commitTransaction 或 abortTransaction 来结束事务。
  session.startTransaction();

  try {
    // 创建问题
    const [question] = await Question.create(
      [{ title, content, author: userId }],
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
          name: { $regex: new RegExp(`^${tag}$`, "i") },
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

    // 创建问题之后，我们还想记录这个操作，以便后续在用户的个人资料页展示用户的活动记录。
    after(async () => {
      await createInteraction({
        action: "post",
        actionId: question._id.toString(),
        actionTarget: "question",
        authorId: userId as string,
      });
    });

    await session.commitTransaction();

    return {
      success: true,
      // 是为了把 Mongoose 文档变成 Next.js 可以安全返回/传递的普通 JSON 对象。
      data: JSON.parse(JSON.stringify(question)),
    };
  } catch (error) {
    await session.abortTransaction();
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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 首先根据 questionId 找到这个问题，并且用 populate("tags") 把它关联的标签信息也查询出来。这样我们就可以拿到这个问题当前有哪些标签了。
    // populate 是 Mongoose 提供的一个方法，用于在查询文档时自动替换指定字段的 ObjectId 为对应的文档内容。在这里，populate("tags") 表示在查询 Question 文档时，自动将 tags 字段中的 ObjectId 替换为对应的 Tag 文档内容。这样我们就可以直接访问 question.tags 来获取这个问题关联的标签信息了，而不需要再额外查询一次 Tag 集合。
    const question = await Question.findById(questionId).populate("tags");
    if (!question) throw new Error("Question not found");
    // 检查一下这个问题的 author 字段（也就是提问者的 ID）和当前用户的 ID 是否一样，如果不一样就说明这个用户没有权限编辑这个问题，我们就抛出一个错误。这里我们把 question.author 转成字符串来比较，因为它是一个 ObjectId 对象，而 userId 是一个字符串。
    if (question.author.toString() !== userId) {
      throw new Error("You are not authorized to edit this question");
    }
    // 如果用户修改了问题的标题或者内容，我们就更新它们。这里我们先检查一下新的标题和内容是否和原来的不一样，如果不一样才去更新，这样可以避免不必要的数据库写操作。
    if (question.title !== title || question.content !== content) {
      question.title = title;
      question.content = content;
      await question.save({ session });
    }

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
          { name: { $regex: `^${tag}$`, $options: "i" } },
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

    // 最后把更新后的问题保存到数据库里
    await session.commitTransaction();

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    await session.abortTransaction();
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
    authorize: true,
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

// 这个函数就是推荐算法的核心实现了。
// 它首先根据用户的历史交互记录（比如浏览、点赞、收藏、提问等）来找出用户感兴趣的标签，
// 然后基于这些标签来推荐相关的问题给用户。
// 它还支持根据用户输入的搜索关键词来进一步过滤推荐结果。
export async function getRecommendedQuestions({
  userId,
  query,
  skip,
  limit,
}: RecommendationParams) {
  // 首先获取用户的历史交互记录，找出用户最近与哪些问题有过交互（比如浏览、点赞、收藏、提问等）。
  // 我们只关注那些与问题相关的交互记录，所以在查询 Interaction 集合时，我们加了一个条件 actionType: "question"，
  // 同时我们也只关注那些 action 是 "view"、"upvote"、"bookmark" 或者 "post" 的交互记录。
  // 我们按照 createdAt 字段降序排序，取最近的 50 条记录。
  const interactions = await Interaction.find({
    user: new Types.ObjectId(userId),
    actionType: "question",
    action: { $in: ["view", "upvote", "bookmark", "post"] },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    // lean() 方法是 Mongoose 提供的一个方法，用于将查询结果转换为普通的 JavaScript 对象，而不是 Mongoose 文档对象。
    // 使用 lean() 可以提高查询性能，特别是在我们不需要使用 Mongoose 文档对象的方法和功能时。由于我们在后续的代码中只是需要访问交互记录的字段，并不需要使用 Mongoose 文档对象的方法，所以使用 lean() 是一个更高效的选择。
    .lean();

  const interactedQuestionIds = interactions.map((i) => i.actionId);
  // 找到最近交互过的问题对应的标签 ID 列表
  // select() 是 Mongoose 用来控制“查询结果返回哪些字段”的方法。
  const interactedQuestions = await Question.find({
    _id: { $in: interactedQuestionIds },
  }).select("tags");

  // flatMap 是 JavaScript 数组的一个方法，它的作用是先对数组中的每个元素执行一个映射函数，
  // 然后将结果扁平化成一个新的数组。在这里，我们对 interactedQuestions 数组中的每个问题对象 q，取出它的 tags 字段（这是一个标签 ID 的数组），然后把这些标签 ID 都放到一个新的数组 allTags 里。这样我们就得到了一个包含了用户最近交互过的所有问题的标签 ID 的数组了。
  const allTags = interactedQuestions.flatMap((q) =>
    q.tags.map((tag: Types.ObjectId) => tag.toString()),
  );
  // 去重
  const uniqueTagIds = [...new Set(allTags)];

  // 构造推荐查询条件，排除用户已经交互过的问题，排除用户自己发布的问题，并且优先推荐那些包含用户感兴趣标签的问题。
  // 如果用户输入了搜索关键词，还要在推荐的基础上进一步过滤，确保推荐结果的标题或者内容里包含这个关键词。
  const recommendedQuery: Record<string, unknown> = {
    _id: { $nin: interactedQuestionIds },
    author: { $ne: new Types.ObjectId(userId) },
    tags: { $in: uniqueTagIds.map((id) => new Types.ObjectId(id)) },
  };

  if (query) {
    recommendedQuery.$or = [
      { title: { $regex: query, $options: "i" } },
      { content: { $regex: query, $options: "i" } },
    ];
  }

  const total = await Question.countDocuments(recommendedQuery);
  // 根据推荐查询条件来查询问题，并且按照 upvotes 和 views 来排序，分页返回给用户。我们同样使用 lean() 方法来提高查询性能。
  const questions = await Question.find(recommendedQuery)
    .populate("tags", "name")
    .populate("author", "name image")
    // 按照点赞数和浏览数来排序，点赞数多的排在前面，如果点赞数一样就按照浏览数来排序，浏览数多的排在前面。
    .sort({ upvotes: -1, views: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    questions: JSON.parse(JSON.stringify(questions)),
    isNext: total > skip + questions.length,
  };
}

// 获取所有基于搜索条件的问题，用于首页展示
export async function getQuestions(
  params: PaginatedSearchParams,
): Promise<ActionResponse<{ questions: Question[]; isNext: boolean }>> {
  const validationResult = await action({
    params,
    schema: PaginatedSearchParamsSchema,
  });
  // 如果输入参数验证失败，validationResult 就会是一个 Error 对象，我们就调用 handleError 函数来处理这个错误，并把处理后的结果作为 ErrorResponse 返回给客户端。这样客户端就可以根据这个错误响应来显示相应的错误信息了。
  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { page = 1, pageSize = 10, query, filter } = validationResult.params;
  // skip 是 MongoDB 查询中的一个参数，用于指定在查询结果中跳过前面多少条记录。它通常与 limit 参数一起使用，用于实现分页功能。
  // 比如，如果 page 是 2，pageSize 是 10，那么 skip 就会是 (2 - 1) * 10 = 10，这意味着查询会跳过前面 10 条记录，返回从第 11 条开始的结果。
  const skip = (page - 1) * pageSize;
  // limit 是 MongoDB 查询中的一个参数，用于指定在查询结果中返回多少条记录。
  // 它通常与 skip 参数一起使用，用于实现分页功能。
  const limit = pageSize;

  const filterQuery: Record<string, unknown> = {};
  let sortCriteria: Record<string, mongoose.SortOrder> = {};

  try {
    // 如果 filter 是 "recommended"，我们就调用 getRecommendedQuestions 函数来获取推荐的问题列表，并且直接返回给客户端，不再执行后续的普通查询逻辑了。
    if (filter === "recommended") {
      const session = await auth();
      const userId = session?.user?.id;
      // 如果用户没有登录，我们就无法根据用户的历史交互记录来推荐问题了，所以我们只能返回一个空的推荐列表，并且 isNext 是 false，表示没有下一页了。
      if (!userId) {
        return { success: true, data: { questions: [], isNext: false } };
      }

      const recommended = await getRecommendedQuestions({
        userId,
        query,
        skip,
        limit,
      });

      return { success: true, data: recommended };
    }

    // 如果 query 存在，我们就构造一个 filterQuery 对象，这个对象会被用来作为 MongoDB 查询的过滤条件。
    // 具体来说，我们使用 $or 操作符来指定多个查询条件，表示只要满足其中一个条件就可以匹配到文档。在这里，我们有两个条件：一个是 title 字段包含 query 字符串（不区分大小写），另一个是 content 字段包含 query 字符串（不区分大小写）。我们使用 $regex 操作符来实现模糊匹配，$options: "i" 表示不区分大小写。
    if (query) {
      filterQuery.$or = [
        { title: { $regex: query, $options: "i" } },
        { content: { $regex: query, $options: "i" } },
      ];
    }
    // 这个 sortCriteria 用于排序
    switch (filter) {
      case "newest":
        sortCriteria = { createdAt: -1 };
        break;
      case "unanswered":
        // 如果 filter 是 "unanswered"，我们就把 filterQuery 对象里添加一个条件，要求 answers 字段的值必须是 0，这样就只会匹配那些没有答案的问题了。同时我们也把 sortCriteria 设置为 { createdAt: -1 }，表示按照创建时间降序排序，这样最新的无答案问题会排在前面。
        filterQuery.answers = 0;
        sortCriteria = { createdAt: -1 };
        break;
      case "popular":
        sortCriteria = { upvotes: -1 };
        break;
      default:
        sortCriteria = { createdAt: -1 };
        break;
    }

    // 计算满足过滤条件的总问题数量，以便判断是否有下一页数据
    const totalQuestions = await Question.countDocuments(filterQuery);

    const questions = await Question.find(filterQuery)
      .populate("tags", "name")
      .populate("author", "name image")
      // lean 方法是 Mongoose 提供的一个方法，用于将查询结果转换成普通的 JavaScript 对象，而不是 Mongoose 文档对象。
      // Mongoose 文档对象包含了很多额外的方法和属性，这些在某些情况下可能会导致性能问题或者内存占用过高。
      // 通过调用 lean() 方法，我们可以让查询结果变得更轻量级，更适合在需要大量读取数据但不需要修改数据的场景下使用。
      .lean()
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);

    // 如果满足过滤条件的总问题数量（totalQuestions）大于当前已经跳过的数量（skip）加上当前查询到的问题数量（questions.length），那么就说明还有下一页数据
    // 也就是总的问题数比已经展示的问题数还多，说明用户翻到下一页还有数据可以看，所以 isNext 就是 true
    const isNext = totalQuestions > skip + questions.length;
    return {
      success: true,
      data: { questions: JSON.parse(JSON.stringify(questions)), isNext },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

// 增加问题的浏览量
export const incrementViews = async (
  params: IncrementViewsParams,
): Promise<ActionResponse<{ views: number }>> => {
  const validationResult = await action({
    params,
    schema: IncrementViewsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params;

  try {
    const question = await Question.findById(questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    question.views += 1;
    await question.save();
    return { success: true, data: { views: question.views } };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};

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
  const session = await mongoose.startSession();

  try {
    // 开启事务，因为删除一个问题需要删除多个相关的文档（比如这个问题的收藏记录、标签关联记录、投票记录、以及这个问题下的所有回答和它们的投票记录），我们需要确保这些操作要么全部成功，要么全部失败，以保持数据的一致性。
    session.startTransaction();

    const question = await Question.findById(questionId).session(session);
    if (!question) throw new Error("Question not found");
    // 必须是自己的才能删，不能删除别人的问题
    if (question.author.toString() !== user?.id) {
      throw new Error("You are not authorized to delete this question");
    }

    // 删除这个问题相关的收藏记录和标签关联记录
    await Collection.deleteMany({ question: questionId }).session(session);
    await TagQuestion.deleteMany({ question: questionId }).session(session);
    // 如果这个问题有关联的标签，我们还需要把这些标签的 questions 数量 -1，以保持数据的一致性。
    if (question.tags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: question.tags } },
        { $inc: { questions: -1 } },
        { session },
      );
    }
    // 删除这个问题的投票记录
    await Vote.deleteMany({
      id: questionId,
      type: "question",
    }).session(session);

    const answers = await Answer.find({ question: questionId }).session(
      session,
    );
    // 删除这个问题下的所有回答以及它们的投票记录。我们先找到这个问题下的所有回答，如果有回答的话，我们就把这些回答的 ID 收集起来，
    // 然后在 Vote 集合里删除那些 id 在这个回答 ID 列表里的投票记录，最后再删除这些回答。
    if (answers.length > 0) {
      await Answer.deleteMany({ question: questionId }).session(session);
      // 删除这些回答的投票记录。我们使用 $in 操作符来指定那些 id 在 answers.map((answer) => answer._id) 这个数组里的投票记录都要被删除掉。同时我们也要指定 type: "answer"，确保只删除回答的投票记录，而不误删了其他类型的投票记录。
      await Vote.deleteMany({
        id: { $in: answers.map((answer) => answer._id) },
        type: "answer",
      }).session(session);
    }
    // 最后删除这个问题
    await Question.findByIdAndDelete(questionId).session(session);

    // 删除问题之后，我们还想记录这个操作，以便后续在用户的个人资料页展示用户的活动记录。
    after(async () => {
      await createInteraction({
        action: "delete",
        actionId: questionId,
        actionTarget: "question",
        authorId: user?.id as string,
      });
    });

    // 提交事务
    await session.commitTransaction();
    // revalidatePath 是 Next.js 提供的一个函数，用于在服务器端重新验证指定路径的数据。
    // 当我们在服务器端执行某些操作（比如删除了一个问题）之后，我们可能需要让客户端知道这个操作已经完成了，以便它可以更新页面上的数据。通过调用 revalidatePath(`/profile/${user?.id}`)，
    // 我们告诉 Next.js 重新验证这个用户个人主页的数据，这样当用户刷新个人主页或者访问个人主页时，就会看到最新的数据了。
    revalidatePath(`/profile/${user?.id}`);

    return { success: true };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}
