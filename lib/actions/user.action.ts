"use server";

import Answer from "@/database/answer.model";
import Question from "@/database/question.model";
import User from "@/database/user.model";
import mongoose, { PipelineStage, Types } from "mongoose";
import action from "../handlers/action";
import handleError from "../handlers/error";
import {
  GetUserAnswersSchema,
  GetUserQuestionsSchema,
  GetUserSchema,
  PaginatedSearchParamsSchema,
} from "../validations";

// 用于 Community 页面获取用户列表
export const getUsers = async (
  params: PaginatedSearchParams,
): Promise<ActionResponse<{ users: User[]; isNext: boolean }>> => {
  const validationResult = await action({
    params,
    schema: PaginatedSearchParamsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { page = 1, pageSize = 10, query, filter } = validationResult.params;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;
  const filterQuery: Record<string, unknown> = {};

  if (query) {
    filterQuery.$or = [
      {
        name: { $regex: query, $options: "i" },
      },
      {
        email: { $regex: query, $options: "i" },
      },
    ];
  }
  let sortCriteria: Record<string, mongoose.SortOrder> = {};
  switch (filter) {
    case "newest":
      // 按照创建时间降序排序，最新的用户排在前面
      sortCriteria = { createdAt: -1 };
      break;
    case "oldest":
      // 按照创建时间升序排序，最老的用户排在前面
      sortCriteria = { createdAt: 1 };
      break;
    case "popular":
      // 按照用户的声誉降序排序，声誉高的用户排在前面
      sortCriteria = { reputation: -1 };
      break;
    default:
      // 默认按照创建时间降序排序
      sortCriteria = { createdAt: -1 };
      break;
  }

  try {
    const totalUsers = await User.countDocuments(filterQuery);
    const users = await User.find(filterQuery)
      .skip(skip)
      .limit(limit)
      .sort(sortCriteria);
    // 计算是否有下一页：如果跳过的数量加上当前页的用户数量小于总用户数，说明还有下一页
    const isNext = skip + users.length < totalUsers;

    return {
      success: true,
      // 因为 User 模型可能包含一些 Mongoose 特有的属性和方法，我们在返回给前端之前，先把它转换成普通的 JavaScript 对象，这样就不会有那些额外的属性了。
      data: { users: JSON.parse(JSON.stringify(users)), isNext },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};

export const getUser = async (
  params: GetUserParams,
): Promise<
  ActionResponse<{ user: User; totalQuestions: number; totalAnswers: number }>
> => {
  const validationResult = await action({
    params,
    schema: GetUserSchema,
  });
  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { userId } = validationResult.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // 计算用户的问题和答案数量
    const totalQuestions = await Question.countDocuments({ author: userId });
    const totalAnswers = await Answer.countDocuments({ author: userId });

    return {
      success: true,
      data: {
        user: JSON.parse(JSON.stringify(user)),
        totalQuestions,
        totalAnswers,
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};

// 用于用户详情页的问题列表展示
export const getUserQuestions = async (
  params: GetUserQuestionsParams,
): Promise<ActionResponse<{ questions: Question[]; isNext: boolean }>> => {
  const validationResult = await action({
    params,
    schema: GetUserQuestionsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { page = 1, pageSize = 10, userId } = validationResult.params;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  try {
    const totalQuestions = await Question.countDocuments({ author: userId });

    const questions = await Question.find({ author: userId })
      // populate 方法的作用是：在查询 Question 文档时，自动将 tags 字段中的 ObjectId 替换为对应的 Tag 文档内容，并且只返回 Tag 文档的 name 字段；
      // 同时也将 author 字段中的 ObjectId 替换为对应的 User 文档内容，并且只返回 User 文档的 name 和 image 字段。这样我们就可以直接访问 question.tags 来获取这个问题关联的标签信息了，而不需要再额外查询一次 Tag 集合；同样也可以直接访问 question.author 来获取这个问题的作者信息了，而不需要再额外查询一次 User 集合。
      .populate("tags", "name")
      .populate("author", "name image")
      .lean()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const isNext = totalQuestions > skip + questions.length;

    return {
      success: true,
      data: { questions: JSON.parse(JSON.stringify(questions)), isNext },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};

// 用于用户详情页的问题列表展示
export const getUserAnswers = async (
  params: GetUserAnswersParams,
): Promise<ActionResponse<{ answers: Answer[]; isNext: boolean }>> => {
  const validationResult = await action({
    params,
    schema: GetUserAnswersSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { page = 1, pageSize = 10, userId } = validationResult.params;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  try {
    const totalQuestions = await Answer.countDocuments({ author: userId });

    const answers = await Answer.find({ author: userId })
      .populate("author", "_id name image")
      .skip(skip)
      .limit(limit);

    const isNext = totalQuestions > skip + answers.length;

    return {
      success: true,
      data: { answers: JSON.parse(JSON.stringify(answers)), isNext },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};

export const getUserTopTags = async (
  params: GetUserTagsParams,
): Promise<
  ActionResponse<{
    tags: { _id: string; name: string; count: number }[];
  }>
> => {
  const validationResult = await action({
    params,
    schema: GetUserAnswersSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { userId } = validationResult.params;

  try {
    const pipeline: PipelineStage[] = [
      { $match: { author: new Types.ObjectId(userId) } },
      // 把数组字段拆成多条文档。因为后面要统计“每个标签出现了几次”，如果 tags 还是数组，就不好按单个标签分组。拆开以后，每一条文档就代表一次标签出现。
      { $unwind: "$tags" },
      // $group 阶段的作用是：按照 tags 字段进行分组，统计每个标签出现的次数，最终输出一个包含标签 ID、标签名称和出现次数的结果数组。
      // 注意这里分组之后其他字段就没了
      {
        $group: {
          // 用 tags 字段的值作为分组依据。
          _id: "$tags",
          // 每遇到一条属于这个分组的文档就给 count 加 1，最终 count 就是这个标签出现的总次数了。
          count: { $sum: 1 },
        },
      },
      // $lookup 阶段的作用是：在上一步分组的基础上，去 tags 集合中查找与 _id 字段（也就是标签 ID）匹配的文档，并把找到的文档内容放到 tagInfo 字段中。这样我们就可以通过 tagInfo 字段来获取标签的详细信息了。
      {
        $lookup: {
          // 去 tags 集合查
          from: "tags",
          localField: "_id",
          foreignField: "_id",
          // 把查到的结果放到 tagInfo 字段里。注意：$lookup 查出来的结果默认是数组，所以 tagInfo 是数组。
          as: "tagInfo",
        },
      },
      {
        $unwind: "$tagInfo",
      },
      // $sort 阶段的作用是：对上一步的结果按照 count 字段进行降序排序，这样出现次数最多的标签就排在前面了。
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
      // 指定最终返回什么字段，以及字段长什么样。
      {
        $project: {
          _id: "$tagInfo._id",
          name: "$tagInfo.name",
          // 表示保留当前文档里的 count 字段。这里的 1 不是数值赋值为 1，而是：把 count 这个字段包含进最终结果
          count: 1,
        },
      },
    ];

    const tags = await Question.aggregate(pipeline);

    return {
      success: true,
      data: { tags: JSON.parse(JSON.stringify(tags)) },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};
