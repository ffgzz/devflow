"use server";

import { auth } from "@/auth";
import ROUTES from "@/constants/routes";
import Answer from "@/database/answer.model";
import Question from "@/database/question.model";
import Vote from "@/database/vote.model";
import { syncVoteInteraction } from "@/lib/dal/interaction";
import mongoose, { ClientSession } from "mongoose";
import { revalidatePath } from "next/cache";
import action from "../handlers/action";
import handleError from "../handlers/error";
import { ForbiddenError, UnauthorizedError } from "../http-errors";
import { hasVotedSchema, SetVoteSchema } from "../validations";

interface VoteMutationState extends HasVotedResponse {
  upvotes: number;
  downvotes: number;
}

interface UpdateVoteCountInput {
  targetId: string;
  targetType: "question" | "answer";
  voteType: "upvote" | "downvote";
  change: 1 | -1;
}

// Keep raw counter updates private. Exported functions in a `use server` file
// are remotely callable, and callers must never be able to mutate a count
// without creating or updating the matching Vote row.
const updateVoteCount = async (
  params: UpdateVoteCountInput,
  session: ClientSession,
): Promise<void> => {
  const { targetId, targetType, voteType, change } = params;
  const Model = targetType === "question" ? Question : Answer;
  const voteField = voteType === "upvote" ? "upvotes" : "downvotes";

  const result = await Model.findByIdAndUpdate(
    targetId,
    { $inc: { [voteField]: change } },
    { new: true, session },
  );

  // Throwing is intentional: the outer transaction is the only place that
  // catches failures, so the Vote row and denormalized counters cannot diverge.
  if (!result || result[voteField] < 0) {
    throw new Error("Failed to update vote count");
  }
};

export const setVote = async (
  params: SetVoteParams,
): Promise<ActionResponse<VoteMutationState>> => {
  const validationResult = await action({
    params,
    schema: SetVoteSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { targetId, targetType, voteType } = validationResult.params;
  const userId = validationResult.session?.user?.id;

  if (!userId) {
    return handleError(new UnauthorizedError()) as ErrorResponse;
  }

  const session = await mongoose.startSession();
  let questionId: string | null = null;
  let mutationState: VoteMutationState | null = null;

  try {
    // withTransaction retries transient write conflicts, which are expected
    // when many users vote on the same denormalized counter document.
    await session.withTransaction(async () => {
      const Model = targetType === "question" ? Question : Answer;
      const contentDoc = await Model.findById(targetId).session(session);
      if (!contentDoc) throw new Error("Content not found");

      const contentAuthorId = contentDoc.author.toString();
      if (contentAuthorId === userId) {
        throw new ForbiddenError("You cannot vote on your own content");
      }

      questionId =
        targetType === "question"
          ? targetId
          : (
              contentDoc as typeof contentDoc & {
                question: mongoose.Types.ObjectId;
              }
            ).question.toString();

      const existingVote = await Vote.findOne({
        author: userId,
        id: targetId,
        type: targetType,
      }).session(session);
      const previousVoteType = existingVote?.voteType ?? null;
      const nextVoteType = voteType;

      // The browser sends the desired final state. Retrying the same request is
      // therefore a no-op instead of accidentally toggling the vote back.
      if (previousVoteType !== nextVoteType) {
        if (existingVote && nextVoteType === null) {
          await Vote.deleteOne({ _id: existingVote._id }).session(session);
          await updateVoteCount(
            {
              targetId,
              targetType,
              voteType: existingVote.voteType,
              change: -1,
            },
            session,
          );
        } else if (existingVote && nextVoteType) {
          await Vote.updateOne(
            { _id: existingVote._id },
            { $set: { voteType: nextVoteType } },
            { session },
          );
          await updateVoteCount(
            {
              targetId,
              targetType,
              voteType: existingVote.voteType,
              change: -1,
            },
            session,
          );
          await updateVoteCount(
            {
              targetId,
              targetType,
              voteType: nextVoteType,
              change: 1,
            },
            session,
          );
        } else if (nextVoteType) {
          await Vote.create(
            [
              {
                author: userId,
                id: targetId,
                type: targetType,
                voteType: nextVoteType,
              },
            ],
            { session },
          );
          await updateVoteCount(
            {
              targetId,
              targetType,
              voteType: nextVoteType,
              change: 1,
            },
            session,
          );
        }

        await syncVoteInteraction(
          {
            targetId,
            targetType,
            performerId: userId,
            authorId: contentAuthorId,
            previousVoteType,
            nextVoteType,
          },
          session,
        );
      }

      const updatedContent = await Model.findById(targetId)
        .select("upvotes downvotes")
        .session(session);
      if (!updatedContent) throw new Error("Content not found after voting");

      mutationState = {
        hasUpvoted: nextVoteType === "upvote",
        hasDownvoted: nextVoteType === "downvote",
        upvotes: updatedContent.upvotes,
        downvotes: updatedContent.downvotes,
      };
    });

    if (!questionId || !mutationState) {
      throw new Error("Vote transaction did not return a result");
    }

    revalidatePath(ROUTES.QUESTION(questionId));
    return {
      success: true,
      data: mutationState,
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
};

export const hasVoted = async (
  params: HasVotedParams,
): Promise<ActionResponse<HasVotedResponse>> => {
  const validationResult = await action({
    params,
    schema: hasVotedSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { targetId, targetType } = validationResult.params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: true,
      data: { hasUpvoted: false, hasDownvoted: false },
    };
  }

  try {
    const vote = await Vote.findOne({
      author: userId,
      id: targetId,
      type: targetType,
    });

    return {
      success: true,
      data: {
        hasUpvoted: vote?.voteType === "upvote",
        hasDownvoted: vote?.voteType === "downvote",
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};
