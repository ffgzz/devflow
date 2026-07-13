import { auth } from "@/auth";
import { readJsonBody } from "@/lib/ai/read-json-body";
import { QuestionWorkbenchDraftSchema } from "@/lib/ai/question-analysis-schema";
import { findSimilarQuestions } from "@/lib/dal/question-similarity";
import handleError from "@/lib/handlers/error";
import { UnauthorizedError, ValidationError } from "@/lib/http-errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new UnauthorizedError();

    const body = await readJsonBody(request);
    const parsed = QuestionWorkbenchDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const rateLimit = await consumeRateLimit({
      identifier: userId,
      limit: 40,
      scope: "similar-question-minute",
      windowMs: 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Too many similarity checks. Please try again shortly.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.retryAfterSeconds.toString(),
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          },
        },
      );
    }

    const result = await findSimilarQuestions(parsed.data);
    return NextResponse.json(
      { success: true, data: result },
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
