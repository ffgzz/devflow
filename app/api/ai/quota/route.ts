import { auth } from "@/auth";
import { getAIQuotaSnapshot } from "@/lib/ai/quota";
import handleError from "@/lib/handlers/error";
import { UnauthorizedError } from "@/lib/http-errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new UnauthorizedError();

    const quota = await getAIQuotaSnapshot(userId);

    return NextResponse.json(
      { success: true, data: quota },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    const response = handleError(error, "api");
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  }
}
