import { dbConnect } from "@/lib/mongoose";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  const startedAt = Date.now();

  try {
    const mongoose = await dbConnect();
    await mongoose.connection.db?.admin().ping();

    return NextResponse.json(
      {
        status: "ok",
        services: { database: "up" },
        responseTimeMs: Date.now() - startedAt,
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        services: { database: "down" },
        responseTimeMs: Date.now() - startedAt,
      },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
