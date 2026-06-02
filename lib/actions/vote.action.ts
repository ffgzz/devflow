"use server";

import Answer from "@/database/answer.model";
import Question from "@/database/question.model";
import Vote from "@/database/vote.model";
import mongoose, { ClientSession } from "mongoose";
import action from "../handlers/action";
import handleError from "../handlers/error";
import {
  CreateVoteSchema,
  hasVotedSchema,
  UpdateVoteCountSchema,
} from "../validations";
import { revalidatePath } from "next/cache";
import ROUTES from "@/constants/routes";

// 更新投票计数
export const updateVoteCount = async (
  params: UpdateVoteCountParams,
  // 这个 ClientSession 类型是 mongoose 用于管理事务的对象，可以在整个事务过程中传递，以确保所有相关的数据库操作都在同一个事务上下文中执行
  session?: ClientSession,
): Promise<ActionResponse> => {
  const validationResult = await action({
    params,
    schema: UpdateVoteCountSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { targetId, targetType, voteType, change } = validationResult.params;
  const Model = targetType === "question" ? Question : Answer;
  // 根据投票类型确定要更新的字段
  const voteField = voteType === "upvote" ? "upvotes" : "downvotes";

  try {
    // 更新数据库的 Question 或 Answer 表中的的投票计数
    const result = await Model.findByIdAndUpdate(
      targetId,
      {
        $inc: { [voteField]: change },
      },
      { new: true, session },
    );

    if (!result) {
      return handleError(
        new Error("Failed to update vote count"),
      ) as ErrorResponse;
    }

    return { success: true };
  } catch (error) {
    session?.abortTransaction(); // 如果发生错误，回滚事务
    return handleError(error) as ErrorResponse;
  }
};

export const createVote = async (
  params: CreateVoteParmas,
): Promise<ActionResponse> => {
  // 只有已经登录的用户才能进行投票
  const validationResult = await action({
    params,
    schema: CreateVoteSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { targetId, targetType, voteType } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  // 开启一个 MongoDB 会话 session
  const session = await mongoose.startSession();
  // 开启事务
  session.startTransaction();
  try {
    // 首先检查用户是否已经对这个目标（问题或答案）投过票
    const existingVote = await Vote.findOne({
      author: userId,
      id: targetId,
      type: targetType,
    }).session(session);

    // 如果 Vote 表中有记录，说明用户之前已经投过票，我们需要根据情况更新或删除这条记录
    if (existingVote) {
      // 如果用户已经投过相同类型的票，再次投相同类型的票表示用户想要取消投票，我们需要删除这条投票记录
      if (existingVote.voteType === voteType) {
        await Vote.deleteOne({ _id: existingVote._id }).session(session);
        // 如果是取消投票，我们还需要将Question或Answer表中对应的计数减少
        await updateVoteCount(
          {
            targetId,
            targetType,
            voteType,
            change: -1,
          },
          session,
        );
      } else {
        // 如果用户已经投过不同类型的票，则更新这条投票记录为新的投票类型
        await Vote.findByIdAndUpdate(
          existingVote._id,
          {
            voteType,
          },
          { new: true, session },
        );
        // 同时需要将之前的投票类型的计数减少，并将新的投票类型的计数增加
        await updateVoteCount(
          {
            targetId,
            targetType,
            voteType: existingVote.voteType,
            change: -1, // 减少之前投票类型的计数
          },
          session,
        );

        await updateVoteCount(
          {
            targetId,
            targetType,
            voteType,
            change: 1, // 增加新投票类型的计数
          },
          session,
        );
      }
    } else {
      // 如果用户之前没有投过票，则在 Vote 表中创建一条新的投票记录
      await Vote.create(
        [{ author: userId, id: targetId, type: targetType, voteType }],
        {
          session,
        },
      );
      // 同时需要将 Question 或 Answer 表中对应的计数增加
      await updateVoteCount(
        {
          targetId,
          targetType,
          voteType,
          change: 1,
        },
        session,
      );
    }

    //  提交事务，确保所有的数据库操作都成功执行，如果有任何一个操作失败，整个事务都会回滚
    await session.commitTransaction();
    // 重新验证相关页面的缓存，以确保用户在投票后看到的是最新的投票计数
    revalidatePath(ROUTES.QUESTION(targetId));
    return { success: true };
  } catch (error) {
    session.abortTransaction(); // 如果发生错误，回滚事务
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
};

// 检查用户是否已经对某个问题或答案投过票
export const hasVoted = async (
  params: HasVotedParams,
): Promise<ActionResponse<HasVotedResponse>> => {
  const validationResult = await action({
    params,
    schema: hasVotedSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { targetId, targetType } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  try {
    // 检查用户是否已经对这个目标（问题或答案）投过票
    const vote = await Vote.findOne({
      author: userId,
      id: targetId,
      type: targetType,
    });

    if (!vote) {
      // 如果没有找到投票记录，说明用户没有投过票，返回默认的响应
      return {
        success: false,
        data: { hasUpvoted: false, hasDownvoted: false },
      };
    }

    return {
      success: true,
      data: {
        hasUpvoted: vote.voteType === "upvote",
        hasDownvoted: vote.voteType === "downvote",
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};
