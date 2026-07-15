import { GLOBAL_SEARCH_TYPES, searchGlobally } from "@/lib/dal/global-search";
import handleError from "@/lib/handlers/error";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const SearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(100),
    type: z.enum(GLOBAL_SEARCH_TYPES).optional(),
  })
  .strict();

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = SearchQuerySchema.safeParse({
      q: url.searchParams.get("q"),
      type: url.searchParams.get("type") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Enter 2 to 100 characters and choose a valid type.",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const data = await searchGlobally({
      query: parsed.data.q,
      type: parsed.data.type,
    });

    return NextResponse.json(
      { success: true, data },
      { status: 200, headers: PRIVATE_NO_STORE_HEADERS },
    );
  } catch (error) {
    const response = handleError(error, "api");
    response.headers.set(
      "Cache-Control",
      PRIVATE_NO_STORE_HEADERS["Cache-Control"],
    );
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
}
