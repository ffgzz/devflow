import { auth } from "@/auth";
import Question from "@/database/question.model";
import RecommendationFeedback from "@/database/recommendation-feedback.model";
import { readJsonBody } from "@/lib/ai/read-json-body";
import handleError from "@/lib/handlers/error";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { consumeRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const FeedbackSchema = z.object({
  questionId: z.string().regex(/^[0-9a-f]{24}$/iu, "Invalid question id"),
  hidden: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new UnauthorizedError();

    const parsed = FeedbackSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const rateLimit = await consumeRateLimit({
      identifier: userId,
      limit: 30,
      scope: "recommendation-feedback-minute",
      windowMs: 60 * 1_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          errors: { message: "Too many feed updates. Please try again soon." },
        },
        {
          status: 429,
          headers: { "Retry-After": rateLimit.retryAfterSeconds.toString() },
        },
      );
    }

    await dbConnect();
    const { questionId, hidden } = parsed.data;
    if (!(await Question.exists({ _id: questionId }))) {
      throw new NotFoundError("Question");
    }

    if (hidden) {
      await RecommendationFeedback.updateOne(
        { user: userId, question: questionId },
        {
          $set: { type: "not_interested" },
          $setOnInsert: { user: userId, question: questionId },
        },
        { upsert: true },
      );
    } else {
      await RecommendationFeedback.deleteMany({
        user: userId,
        question: questionId,
      });
    }

    return NextResponse.json(
      { success: true, data: { hidden } },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return handleError(error, "api");
  }
}
