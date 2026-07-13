import { NextResponse } from "next/server";

/**
 * OAuth synchronization now runs inside the Auth.js callback and is not an
 * HTTP API. Keep an inert response here so stale clients cannot mutate auth
 * records and receive an explicit migration signal.
 */
export function POST() {
  return NextResponse.json(
    {
      success: false,
      error: { message: "This endpoint is no longer available." },
    },
    { status: 410 },
  );
}
