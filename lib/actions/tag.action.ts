import Question from "@/database/question.model";
import Tag from "@/database/tag.model";
import mongoose from "mongoose";
import action from "../handlers/action";
import handleError from "../handlers/error";
import { dbConnect } from "../mongoose";
import {
  GetTagQuestionsSchema,
  PaginatedSearchParamsSchema,
} from "../validations";

export const getTags = async (
  params: PaginatedSearchParams,
): Promise<ActionResponse<{ tags: Tag[]; isNext: boolean }>> => {
  const validationResult = await action({
    params,
    schema: PaginatedSearchParamsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { page = 1, pageSize = 10, query, filter } = validationResult.params;
  const skip = pageSize * (page - 1);
  const limit = pageSize;

  const filterQuery: Record<string, unknown> = {};
  if (query) {
    filterQuery.$or = [{ name: { $regex: query, $options: "i" } }];
  }
  // 排序
  let sortCriteria: Record<string, mongoose.SortOrder> = {};
  switch (filter) {
    case "popular":
      sortCriteria = { questions: -1 }; // 按问题数量降序排序
      break;
    case "recent":
      sortCriteria = { createdAt: -1 }; // 按创建时间降序排序
      break;
    case "oldest":
      sortCriteria = { createdAt: 1 }; // 按创建时间升序排序
      break;
    case "name":
      sortCriteria = { name: 1 }; // 按名称升序排序
      break;
    default:
      sortCriteria = { questions: -1 }; // 默认按问题数量降序排序
      break;
  }

  try {
    const totalTags = await Tag.countDocuments(filterQuery);
    const tags = await Tag.find(filterQuery)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);

    const isNext = skip + tags.length < totalTags;
    return {
      success: true,
      data: { tags: JSON.parse(JSON.stringify(tags)), isNext },
    };
  } catch (error) {
    return handleError(error as Error) as ErrorResponse;
  }
};

// 用于获取某个标签下的所有问题列表，支持分页和搜索功能。
export const getTagQuestions = async (
  params: GetTagQuestionsParams,
): Promise<
  ActionResponse<{ tag: Tag; questions: Question[]; isNext: boolean }>
> => {
  const validationResult = await action({
    params,
    schema: GetTagQuestionsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { tagId, page = 1, pageSize = 10, query } = validationResult.params;
  const skip = pageSize * (page - 1);
  const limit = pageSize;

  try {
    // 首先，我们需要验证这个标签 ID 是否存在，以确保我们要查询的问题确实属于一个有效的标签。
    const tag = await Tag.findById(tagId);
    if (!tag) throw new Error("Tag not found");

    // 这个查询条件的意思是：我们要找的问题必须包含这个标签 ID（$in 操作符表示在 tags 数组中查找包含 tagId 的问题）。
    // 如果用户还提供了搜索查询（query），我们就进一步过滤问题的标题，使用正则表达式进行模糊匹配，确保标题中包含用户输入的查询字符串（不区分大小写）。
    const filterQuery: Record<string, unknown> = { tags: { $in: [tagId] } };
    if (query) {
      filterQuery.title = { $regex: query, $options: "i" };
    }
    // 获取满足条件的问题总数
    const totalQuestions = await Question.countDocuments(filterQuery);
    const questions = await Question.find(filterQuery)
      .select("_id title views answers upvotes downvotes author createdAt tags") // 只选择需要的字段，减少数据传输
      .populate([
        {
          path: "author",
          select: "_id name image", // 只选择作者的必要字段
        },
        {
          path: "tags",
          select: "name", // 只选择标签的必要字段
        },
      ])
      .skip(skip)
      .limit(limit);

    const isNext = skip + questions.length < totalQuestions;
    // 返回标签和对应的问题列表，以及是否有下一页的数据
    return {
      success: true,
      data: {
        tag: JSON.parse(JSON.stringify(tag)),
        questions: JSON.parse(JSON.stringify(questions)),
        isNext,
      },
    };
  } catch (error) {
    return handleError(error as Error) as ErrorResponse;
  }
};

// 用于右侧边栏
export const getHotTags = async (): Promise<ActionResponse<Tag[]>> => {
  try {
    await dbConnect();

    const tags = await Tag.find().sort({ questions: -1 }).limit(5);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(tags)),
    };
  } catch (error) {
    return handleError(error as Error) as ErrorResponse;
  }
};
