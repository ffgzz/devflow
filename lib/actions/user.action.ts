"use server";

import User from "@/database/user.model";
import action from "../handlers/action";
import handleError from "../handlers/error";
import { PaginatedSearchParamsSchema } from "../validations";
import mongoose from "mongoose";

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
