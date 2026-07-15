import "server-only";

import Interaction from "@/database/interaction.model";
import Question from "@/database/question.model";
import logger from "@/lib/logger";
import { dbConnect } from "@/lib/mongoose";

/**
 * Records a public view and, when the authenticated id was captured during
 * rendering, refreshes one bounded recommendation signal. This helper is
 * server-only so a browser can never submit another user's id.
 */
export async function recordQuestionView(questionId: string, userId?: string) {
  await dbConnect();
  const question = await Question.findByIdAndUpdate(
    questionId,
    { $inc: { views: 1 } },
    { new: true },
  ).select("_id views");
  if (!question) return null;

  if (userId) {
    try {
      const now = new Date();
      await Interaction.updateOne(
        {
          user: userId,
          action: "view",
          actionId: questionId,
          actionType: "question",
        },
        {
          $set: { updatedAt: now },
          $setOnInsert: {
            user: userId,
            action: "view",
            actionId: questionId,
            actionType: "question",
            createdAt: now,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      logger.warn(
        { err: error, questionId },
        "Failed to refresh the authenticated question-view signal",
      );
    }
  }

  return question.views;
}
