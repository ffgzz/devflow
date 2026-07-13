import { auth } from "@/auth";
import handleError from "@/lib/handlers/error";
import { RequestError, UnauthorizedError, ValidationError } from "@/lib/http-errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import { AIAnswerSchema } from "@/lib/validations";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";

const envValue = (name: string) => process.env[name]?.trim() || undefined;
const apiKey = envValue("AI_API_KEY") ?? envValue("MINIMAX_API_KEY");
const deepseek = createOpenAI({
  baseURL:
    envValue("AI_BASE_URL") ??
    envValue("MINIMAX_BASE_URL") ??
    "https://api.deepseek.com",
  apiKey,
});

const positiveIntegerFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

const rateLimitResponse = (
  result: Awaited<ReturnType<typeof consumeRateLimit>>,
) =>
  NextResponse.json(
    {
      success: false,
      error: {
        message: "AI request limit reached. Please try again later.",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": result.retryAfterSeconds.toString(),
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
      },
    },
  );

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new UnauthorizedError();
    if (!apiKey) {
      throw new RequestError(503, "AI service is not configured.");
    }

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
      throw new RequestError(413, "Request body is too large.");
    }

    const body = await req.json();
    const validatedData = AIAnswerSchema.safeParse(body);

    if (!validatedData.success) {
      throw new ValidationError(
        validatedData.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const { question, content, userAnswer } = validatedData.data;

    const hourlyLimit = await consumeRateLimit({
      identifier: userId,
      limit: positiveIntegerFromEnv("AI_RATE_LIMIT_PER_HOUR", 10),
      scope: "ai-answer-hour",
      windowMs: 60 * 60 * 1000,
    });
    if (!hourlyLimit.allowed) return rateLimitResponse(hourlyLimit);

    const dailyLimit = await consumeRateLimit({
      identifier: userId,
      limit: positiveIntegerFromEnv("AI_RATE_LIMIT_PER_DAY", 30),
      scope: "ai-answer-day",
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!dailyLimit.allowed) return rateLimitResponse(dailyLimit);

    const abortSignal = AbortSignal.any([
      req.signal,
      AbortSignal.timeout(30_000),
    ]);

    const { text } = await generateText({
      model: deepseek.chat(envValue("AI_MODEL") ?? "deepseek-v4-flash"),
      abortSignal,
      maxOutputTokens: positiveIntegerFromEnv("AI_MAX_OUTPUT_TOKENS", 1800),
      system:
        "你是一位乐于助人的助手，会以 Markdown 格式提供内容详实的回复。在必要时，请使用恰当的 Markdown 语法来呈现标题、列表、代码块和强调文本。对于代码块，请使用小写的短格式语言标识符（例如：用 js 表示 JavaScript，py 表示 Python，ts 表示 TypeScript，html 表示 HTML，css 表示 CSS 等）。",
      prompt: `请针对以下问题生成一个Markdown格式的回答："${question}"。

      请参考提供的上下文：
      **上下文：** ${content}

      另外，在构建回答时，请优先采纳并整合用户的答案：
      **用户答案：** ${userAnswer ?? "（用户尚未填写答案）"}

      仅当用户答案正确时才优先采纳。如果用户答案不完整或错误，请在保持回答简洁、切中要点的前提下进行完善或修正。
      最终请以Markdown格式提供答案。`,
    });

    return NextResponse.json({ success: true, data: text }, { status: 200 });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      return handleError(
        new RequestError(504, "The AI request timed out. Please try again."),
        "api",
      );
    }

    return handleError(error, "api");
  }
}
