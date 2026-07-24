import {
  CLIENT_ERROR_SOURCES,
  NAVIGATION_TYPES,
  sanitizeErrorName,
  sanitizePathname,
  WEB_VITAL_NAMES,
  WEB_VITAL_RATINGS,
} from "@/lib/observability/shared";
import {
  FORWARDED_HEADER,
  isServerObservabilityEnabled,
  recordObservabilityEvent,
} from "@/lib/observability/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4_096;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

const WebVitalEventSchema = z
  .object({
    kind: z.literal("web-vital"),
    delta: z.number().finite().min(-10_000_000).max(10_000_000),
    metricId: z.string().min(1).max(128).regex(/^[a-z\d_.:-]+$/i),
    name: z.enum(WEB_VITAL_NAMES),
    navigationType: z.enum(NAVIGATION_TYPES),
    path: z.string().min(1).max(240),
    rating: z.enum(WEB_VITAL_RATINGS),
    value: z.number().finite().min(0).max(10_000_000),
  })
  .strict();

const ClientErrorEventSchema = z
  .object({
    kind: z.literal("client-error"),
    column: z.number().int().min(1).max(10_000_000).optional(),
    digest: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z\d_.:-]+$/i)
      .optional(),
    errorName: z.string().min(1).max(64).regex(/^[a-z\d_.:-]+$/i),
    fingerprint: z.string().regex(/^fnv1a-[a-f\d]{8}$/),
    line: z.number().int().min(1).max(10_000_000).optional(),
    path: z.string().min(1).max(240),
    scriptPath: z.string().min(1).max(240).optional(),
    source: z.enum(CLIENT_ERROR_SOURCES),
  })
  .strict();

const BrowserEventSchema = z.discriminatedUnion("kind", [
  WebVitalEventSchema,
  ClientErrorEventSchema,
]);

const emptyResponse = (status: number) =>
  new NextResponse(null, { status, headers: NO_STORE_HEADERS });

export async function POST(request: Request) {
  if (!isServerObservabilityEnabled()) return emptyResponse(204);

  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    !origin ||
    origin !== requestOrigin ||
    (fetchSite && fetchSite !== "same-origin")
  ) {
    return emptyResponse(403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return emptyResponse(413);

  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return emptyResponse(413);
    }

    const parsed = BrowserEventSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return emptyResponse(400);

    const event = {
      ...parsed.data,
      ...(parsed.data.kind === "client-error"
        ? { errorName: sanitizeErrorName(parsed.data.errorName) }
        : {}),
      path: sanitizePathname(parsed.data.path),
      ...(parsed.data.kind === "client-error" && parsed.data.scriptPath
        ? {
            scriptPath:
              parsed.data.scriptPath === "[cross-origin]"
                ? parsed.data.scriptPath
                : sanitizePathname(parsed.data.scriptPath),
          }
        : {}),
    };

    await recordObservabilityEvent(event, {
      // Prevent a configuration mistake that points the external endpoint back
      // to this route from creating a forwarding loop.
      forward: request.headers.get(FORWARDED_HEADER) !== "1",
    });

    return emptyResponse(202);
  } catch {
    return emptyResponse(400);
  }
}
