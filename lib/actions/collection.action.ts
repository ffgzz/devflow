"use server";

import ROUTES from "@/constants/routes";
import Collection from "@/database/collection.model";
import Question from "@/database/question.model";
import mongoose, { PipelineStage } from "mongoose";
import { revalidatePath } from "next/cache";
import action from "../handlers/action";
import handleError from "../handlers/error";
import {
  CollectionBaseSchema,
  PaginatedSearchParamsSchema,
} from "../validations";

// 收藏和取消收藏问题的函数
export const toggleSaveQuestion = async (
  params: CollectionBaseParams,
): Promise<ActionResponse<{ saved: boolean }>> => {
  const validationResult = await action({
    params,
    schema: CollectionBaseSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  try {
    const question = await Question.findById(questionId);
    if (!question) throw new Error("Question not found");

    const collection = await Collection.findOne({
      author: userId,
      question: questionId,
    });
    // 如果收藏夹中已经存在该问题，则意味着用户想要取消收藏，所以我们删除该收藏记录
    if (collection) {
      await Collection.findByIdAndDelete(collection._id);

      revalidatePath(ROUTES.QUESTION(questionId));

      return {
        success: true,
        data: { saved: false },
      };
    }

    await Collection.create({
      author: userId,
      question: questionId,
    });

    revalidatePath(ROUTES.QUESTION(questionId));

    return {
      success: true,
      data: { saved: true },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};

// 用户是否收藏了当前问题
export const hasSavedQuestion = async (
  params: CollectionBaseParams,
): Promise<ActionResponse<{ saved: boolean }>> => {
  const validationResult = await action({
    params,
    schema: CollectionBaseSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  try {
    const collection = await Collection.findOne({
      author: userId,
      question: questionId,
    });

    return {
      success: true,
      data: { saved: !!collection },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};

// 获取用户收藏的问题列表，并支持分页、搜索和排序功能
export const getSavedQuestions = async (
  params: PaginatedSearchParams,
): Promise<ActionResponse<{ collection: Collection[]; isNext: boolean }>> => {
  const validationResult = await action({
    params,
    schema: PaginatedSearchParamsSchema,
    // 登录了才能访问收藏列表，因为收藏是用户特有的数据，所以我们需要确保用户已经登录了才能获取他们的收藏列表。
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { page = 1, pageSize = 10, query, filter } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const sortOptions: Record<string, Record<string, 1 | -1>> = {
    mostrecent: { "question.createdAt": -1 },
    oldest: { "question.createdAt": 1 },
    mostvoted: { "question.upvotes": -1 },
    mostviewed: { "question.views": -1 },
    mostanswered: { "question.answers": -1 },
  };

  const sortCriteria = sortOptions[filter as keyof typeof sortOptions] || {
    "question.createdAt": -1,
  };

  try {
    // 这里的 pipeline 是 MongoDB aggregation pipeline，中文可以理解成“聚合查询流水线”。
    // 它是一个数组，数组里每个对象都是一个查询步骤
    // 这里的这个的用处是为了在获取用户收藏的问题时，同时获取这些问题的详细信息（包括作者和标签），以便在前端展示完整的问题信息。
    const pipeline: PipelineStage[] = [
      // $match 阶段是用来过滤数据的，这里根据用户 ID 过滤出该用户收藏的所有问题。
      { $match: { author: new mongoose.Types.ObjectId(userId) } },
      {
        // $lookup 阶段是用来进行集合连接的，这里是将收藏记录中的 question 字段（它是一个问题的 ID）与 questions 集合中的 _id 字段进行匹配，找到对应的问题详细信息，并将结果存储在 question 字段中。
        $lookup: {
          // 表示要连接的目标集合，这里是 questions 集合
          from: "questions",
          // 表示当前集合（collections）中的哪个字段要用来匹配，这里是 question 字段，它存储了被收藏问题的 ID。
          localField: "question",
          // 表示目标集合（questions）中的哪个字段要用来匹配，这里是 _id 字段，因为我们要根据收藏记录中的 question ID 来查找对应的问题。
          foreignField: "_id",
          // 表示将匹配到的结果存储在当前文档中的哪个字段，这里也是 question 字段，这样每个收藏记录中就会有一个 question 字段，里面包含了对应的问题详细信息。
          as: "question",
        },
      },
      // $unwind 阶段是用来将数组类型的字段拆分成多条记录的，这里是因为 $lookup 后 question 字段是一个数组（即使只有一个匹配项），所以需要使用 $unwind 将其拆分成单个对象，方便后续处理。
      {
        $unwind: "$question",
      },
      // 这里的第二个 $lookup 是为了进一步获取问题的作者信息和标签信息。因为在上一个 $lookup 后，question 字段已经包含了问题的详细信息，但其中的 author 字段只是一个用户 ID，tags 字段也是一个标签 ID 数组，所以需要通过 $lookup 再次连接 users 和 tags 集合来获取完整的作者和标签信息。
      {
        $lookup: {
          from: "users",
          localField: "question.author",
          foreignField: "_id",
          as: "question.author",
        },
      },
      {
        $unwind: "$question.author",
      },
      {
        $lookup: {
          from: "tags",
          localField: "question.tags",
          foreignField: "_id",
          as: "question.tags",
        },
      },
    ];

    if (query) {
      pipeline.push({
        // $match 阶段是用来过滤数据的，这里根据用户输入的搜索关键词 query 来过滤问题，使用 $regex 进行模糊匹配，$options: "i" 表示不区分大小写。
        $match: {
          $or: [
            { "question.title": { $regex: query, $options: "i" } },
            { "question.content": { $regex: query, $options: "i" } },
          ],
        },
      });
    }
    // aggregate 函数是用来执行聚合操作的，它接受一个管道数组作为参数，管道数组中的每个元素都是一个聚合阶段，定义了数据处理的不同步骤。
    // 这里的意思就是先根据用户 ID 过滤出该用户收藏的所有问题，然后通过 $lookup 阶段将这些问题的详细信息（包括作者和标签）从相关的集合中查找出来，最后根据指定的排序条件对结果进行排序。
    const [totalCount] = await Collection.aggregate([
      ...pipeline,
      // $count 阶段是用来统计数据数量的，这里是统计经过前面几个阶段过滤和连接后的结果数量，也就是用户收藏的问题总数，结果会存储在 count 字段中。
      { $count: "count" },
    ]);
    // $sort 阶段是用来对数据进行排序的，这里根据用户选择的排序条件（如 mostrecent、oldest、mostvoted 等）来排序收藏的问题。
    pipeline.push({ $sort: sortCriteria }, { $skip: skip }, { $limit: limit });

    // 控制最终返回哪些字段，这里的意思是最后结果里只保留 question 字段（1 表示包含这个字段）
    pipeline.push({
      $project: {
        question: 1,
      },
    });
    // 所以这里得到的只有 question 字段，里面包含了问题的详细信息（包括作者和标签），而其他字段（如收藏记录的 _id、user 等）都被排除掉了。
    const questions = await Collection.aggregate(pipeline);
    const isNext = skip + questions.length < totalCount.count;
    return {
      success: true,
      data: {
        collection: JSON.parse(JSON.stringify(questions)),
        isNext,
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};
