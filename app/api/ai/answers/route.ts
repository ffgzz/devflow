import handleError from "@/lib/handlers/error";
import { ValidationError } from "@/lib/http-errors";
import { AIAnswerSchema } from "@/lib/validations";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";

const deepseek = createOpenAI({
  baseURL: process.env.MINIMAX_BASE_URL ?? "https://api.deepseek.com",
  apiKey: process.env.MINIMAX_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = AIAnswerSchema.safeParse(body);

    if (!validatedData.success) {
      throw new ValidationError(
        validatedData.error.flatten().fieldErrors as Record<string, string[]>,
      );
    }

    const { question, content, userAnswer } = validatedData.data;

    const { text } = await generateText({
      model: deepseek.chat("deepseek-v4-flash"),
      system:
        "你是一位乐于助人的助手，会以 Markdown 格式提供内容详实的回复。在必要时，请使用恰当的 Markdown 语法来呈现标题、列表、代码块和强调文本。对于代码块，请使用小写的短格式语言标识符（例如：用 js 表示 JavaScript，py 表示 Python，ts 表示 TypeScript，html 表示 HTML，css 表示 CSS 等）。",
      prompt: `请针对以下问题生成一个Markdown格式的回答："${question}"。

      请参考提供的上下文：
      **上下文：** ${content}

      另外，在构建回答时，请优先采纳并整合用户的答案：
      **用户答案：** ${userAnswer}

      仅当用户答案正确时才优先采纳。如果用户答案不完整或错误，请在保持回答简洁、切中要点的前提下进行完善或修正。
      最终请以Markdown格式提供答案。`,
    });

    return NextResponse.json({ success: true, data: text }, { status: 200 });
  } catch (error) {
    return handleError(error, "api");
  }
}
