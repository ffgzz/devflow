import { auth } from "@/auth";
import { getQuestionFeed } from "@/lib/dal/question-feed";
import { FeedCursorError } from "@/lib/recommendation/cursor.mjs";
import { QUESTION_FEED_FILTERS } from "@/lib/recommendation/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const FeedQuerySchema = z.object({
  filter: z.enum(QUESTION_FEED_FILTERS).default("newest"),
  query: z.string().trim().max(100).optional(),
  cursor: z.string().max(1_024).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = FeedQuerySchema.safeParse({
    filter: url.searchParams.get("filter") || undefined,
    query: url.searchParams.get("query") || undefined,
    cursor: url.searchParams.get("cursor") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        errors: {
          message: "Invalid feed query.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400, headers: privateHeaders },
    );
  }

  try {
    const session = await auth();
    const data = await getQuestionFeed({
      ...parsed.data,
      userId: session?.user?.id,
    });
    return NextResponse.json(
      { success: true, data },
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof FeedCursorError) {
      return NextResponse.json(
        {
          success: false,
          errors: { message: "This feed cursor is invalid or expired." },
        },
        { status: 400, headers: privateHeaders },
      );
    }

    return NextResponse.json(
      {
        success: false,
        errors: { message: "The question feed is temporarily unavailable." },
      },
      { status: 500, headers: privateHeaders },
    );
  }
}
