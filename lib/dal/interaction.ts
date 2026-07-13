import "server-only";

import Interaction from "@/database/interaction.model";
import User from "@/database/user.model";
import Vote from "@/database/vote.model";
import type { ClientSession } from "mongoose";

type TargetType = "question" | "answer";
type VoteType = "upvote" | "downvote";

interface ContentInteractionInput {
  action: "post" | "delete";
  targetId: string;
  targetType: TargetType;
  userId: string;
}

interface VoteInteractionInput {
  targetId: string;
  targetType: TargetType;
  performerId: string;
  authorId: string;
  previousVoteType: VoteType | null;
  nextVoteType: VoteType | null;
}

interface ContentVoteTarget {
  targetId: string;
  targetType: TargetType;
  authorId: string;
}

const votePoints: Record<
  VoteType,
  { performer: number; author: number }
> = {
  upvote: { performer: 2, author: 10 },
  downvote: { performer: -1, author: -2 },
};

/**
 * Records a content lifecycle event and its reputation change. This is a
 * server-only domain helper: ids must be derived from authenticated database
 * state by the caller, never accepted from a browser-facing action.
 */
export async function recordContentInteraction(
  input: ContentInteractionInput,
  session: ClientSession,
) {
  const reputationChange =
    (input.targetType === "question" ? 5 : 10) *
    (input.action === "post" ? 1 : -1);

  await Interaction.create(
    [
      {
        user: input.userId,
        action: input.action,
        actionId: input.targetId,
        actionType: input.targetType,
      },
    ],
    { session },
  );

  const user = await User.findByIdAndUpdate(
    input.userId,
    { $inc: { reputation: reputationChange } },
    { session, new: true },
  );

  if (!user) throw new Error("Interaction user not found");
}

/**
 * Makes Interaction and reputation reflect the final Vote row. Reversing or
 * switching a vote applies only the difference between the old and new state.
 */
export async function syncVoteInteraction(
  input: VoteInteractionInput,
  session: ClientSession,
) {
  const previousPoints = input.previousVoteType
    ? votePoints[input.previousVoteType]
    : { performer: 0, author: 0 };
  const nextPoints = input.nextVoteType
    ? votePoints[input.nextVoteType]
    : { performer: 0, author: 0 };
  const performerDelta = nextPoints.performer - previousPoints.performer;
  const authorDelta = nextPoints.author - previousPoints.author;

  // Vote interactions represent current behavior for recommendation. Remove
  // any legacy duplicates before writing the single final state.
  await Interaction.deleteMany({
    user: input.performerId,
    actionId: input.targetId,
    actionType: input.targetType,
    action: { $in: ["upvote", "downvote"] },
  }).session(session);

  if (input.nextVoteType) {
    await Interaction.create(
      [
        {
          user: input.performerId,
          action: input.nextVoteType,
          actionId: input.targetId,
          actionType: input.targetType,
        },
      ],
      { session },
    );
  }

  if (performerDelta === 0 && authorDelta === 0) return;

  const result = await User.bulkWrite(
    [
      {
        updateOne: {
          filter: { _id: input.performerId },
          update: { $inc: { reputation: performerDelta } },
        },
      },
      {
        updateOne: {
          filter: { _id: input.authorId },
          update: { $inc: { reputation: authorDelta } },
        },
      },
    ],
    { session },
  );

  if (result.matchedCount !== 2) {
    throw new Error("Vote reputation users not found");
  }
}

/**
 * Deleting content removes its current Vote rows, so it must also remove the
 * matching current-state interactions and reverse their reputation effects.
 */
export async function rollbackVoteInteractionsForTargets(
  targets: ContentVoteTarget[],
  session: ClientSession,
) {
  if (targets.length === 0) return;

  const targetByKey = new Map(
    targets.map((target) => [
      `${target.targetType}:${target.targetId}`,
      target,
    ]),
  );
  const targetFilters = targets.map((target) => ({
    id: target.targetId,
    type: target.targetType,
  }));
  const votes = await Vote.find({ $or: targetFilters }).session(session);
  const reputationDeltaByUser = new Map<string, number>();
  const addDelta = (userId: string, delta: number) => {
    reputationDeltaByUser.set(
      userId,
      (reputationDeltaByUser.get(userId) ?? 0) + delta,
    );
  };

  for (const vote of votes) {
    const target = targetByKey.get(`${vote.type}:${vote.id.toString()}`);
    if (!target) continue;

    const voterId = vote.author.toString();
    const points = votePoints[vote.voteType];

    // Legacy versions allowed self-votes and awarded only the author portion.
    // Reverse that historical rule while all new self-votes are rejected.
    if (voterId === target.authorId) {
      addDelta(target.authorId, -points.author);
    } else {
      addDelta(voterId, -points.performer);
      addDelta(target.authorId, -points.author);
    }
  }

  await Interaction.deleteMany({
    $or: targets.map((target) => ({
      actionId: target.targetId,
      actionType: target.targetType,
    })),
    action: { $in: ["upvote", "downvote"] },
  }).session(session);

  const reputationUpdates = [...reputationDeltaByUser.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([userId, delta]) => ({
      updateOne: {
        filter: { _id: userId },
        update: { $inc: { reputation: delta } },
      },
    }));

  if (reputationUpdates.length > 0) {
    await User.bulkWrite(reputationUpdates, { session });
  }
}
