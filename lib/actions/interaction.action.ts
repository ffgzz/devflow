"use server";

import { Interaction, User } from "@/database";
import { IInteractionDoc } from "@/database/interaction.model";
import mongoose from "mongoose";
import action from "../handlers/action";
import handleError from "../handlers/error";
import { CreateInteractionSchema } from "../validations";

// 这个函数用于创建用户交互记录，并根据交互类型来更新用户的声誉分数。
export async function createInteraction(
  params: CreateInteractionParams,
): Promise<ActionResponse<IInteractionDoc>> {
  const validationResult = await action({
    params,
    schema: CreateInteractionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const {
    // 操作的类型
    action: actionType,
    actionId,
    actionTarget,
    // 被操作对象的作者 ID，我们需要这个信息来更新其作者的声誉分数
    authorId,
  } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 注意这里 create 方法返回的是一个数组，因为它支持批量创建，所以我们用解构赋值的方式来获取创建的交互记录。
    const [interaction] = await Interaction.create(
      [
        {
          user: userId,
          // 注意区分这里的变量名，参数里的 actionType 表示操作类型，模型里的 actionType 则是操作对象（问题或答案）
          action: actionType,
          actionId,
          actionType: actionTarget,
        },
      ],
      { session },
    );

    // 创建之后，我们需要根据交互的类型来更新用户的声誉分数。
    // 比如，如果是 upvote，就给执行操作的用户加 2 分，给被操作对象的作者加 10 分；
    // 如果是 downvote，就给执行操作的用户扣 1 分，给被操作对象的作者扣 2 分；
    // 如果是 post，就给被操作对象的作者加分，问题加 5 分，答案加 10 分；如果是 delete，就给被操作对象的作者扣分，问题扣 5 分，答案扣 10 分。
    await updateReputation({
      interaction,
      session,
      performerId: userId!,
      authorId,
    });

    await session.commitTransaction();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(interaction)),
    };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

// 更新用户声誉分数的函数。它根据交互的类型来计算执行操作的用户和被操作对象的作者应该加多少分或扣多少分，然后更新他们的声誉分数。
async function updateReputation(params: UpdateReputationParams) {
  const { interaction, session, performerId, authorId } = params;
  const { action: interactionAction, actionType } = interaction;

  // 操作者和作者的分数增减值
  let performerPoints = 0;
  let authorPoints = 0;

  switch (interactionAction) {
    case "upvote":
      performerPoints = 2;
      authorPoints = 10;
      break;
    case "downvote":
      performerPoints = -1;
      authorPoints = -2;
      break;
    case "post":
      authorPoints = actionType === "question" ? 5 : 10;
      break;
    case "delete":
      authorPoints = actionType === "question" ? -5 : -10;
      break;
  }

  // 如果执行操作的用户和被操作对象的作者是同一个人，我们只需要更新一次用户的声誉分数，直接把增减值加到这个用户身上就行了。
  if (performerId === authorId) {
    await User.findByIdAndUpdate(
      performerId,
      { $inc: { reputation: authorPoints } },
      { session },
    );

    return;
  }

  // 如果执行操作的用户和被操作对象的作者不是同一个人，我们需要分别更新他们的声誉分数，
  // 所以我们使用 bulkWrite 来同时更新两个用户的声誉分数。
  // 这个 bulkWrite 函数是 Mongoose 提供的一个批量写入方法，它接受一个操作数组，每个操作都包含一个 updateOne 操作，指定要更新哪个用户（通过 filter）和要更新的内容（通过 update），以及使用同一个 session 来保证事务的一致性。
  await User.bulkWrite(
    [
      {
        updateOne: {
          filter: { _id: performerId },
          update: { $inc: { reputation: performerPoints } },
        },
      },
      {
        updateOne: {
          filter: { _id: authorId },
          update: { $inc: { reputation: authorPoints } },
        },
      },
    ],
    { session },
  );
}
