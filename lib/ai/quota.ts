import "server-only";

import { consumeRateLimit, type RateLimitResult } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { positiveIntegerFromEnv } from "./provider";

interface AllowedAIQuota {
  allowed: true;
  hour: RateLimitResult;
  day: RateLimitResult;
}

interface BlockedAIQuota {
  allowed: false;
  scope: "hour" | "day";
  blocked: RateLimitResult;
}

export type AIQuotaResult = AllowedAIQuota | BlockedAIQuota;

export async function consumeAIQuota(userId: string): Promise<AIQuotaResult> {
  const hour = await consumeRateLimit({
    identifier: userId,
    limit: positiveIntegerFromEnv("AI_RATE_LIMIT_PER_HOUR", 10),
    scope: "ai-hour",
    windowMs: 60 * 60 * 1000,
  });
  if (!hour.allowed) return { allowed: false, scope: "hour", blocked: hour };

  const day = await consumeRateLimit({
    identifier: userId,
    limit: positiveIntegerFromEnv("AI_RATE_LIMIT_PER_DAY", 30),
    scope: "ai-day",
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!day.allowed) return { allowed: false, scope: "day", blocked: day };

  return { allowed: true, hour, day };
}

export const quotaHeaders = (quota: AllowedAIQuota) => ({
  "X-RateLimit-Limit": quota.day.limit.toString(),
  "X-RateLimit-Remaining": quota.day.remaining.toString(),
  "X-RateLimit-Reset": Math.ceil(
    quota.day.resetAt.getTime() / 1000,
  ).toString(),
  "X-RateLimit-Hour-Remaining": quota.hour.remaining.toString(),
  "X-RateLimit-Day-Remaining": quota.day.remaining.toString(),
});

export const aiQuotaResponse = (quota: BlockedAIQuota) =>
  NextResponse.json(
    {
      success: false,
      error: {
        code: "AI_QUOTA_EXCEEDED",
        scope: quota.scope,
        message:
          quota.scope === "day"
            ? "Your daily AI limit has been reached."
            : "Your hourly AI limit has been reached.",
        retryAfterSeconds: quota.blocked.retryAfterSeconds,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": quota.blocked.retryAfterSeconds.toString(),
        "X-RateLimit-Limit": quota.blocked.limit.toString(),
        "X-RateLimit-Remaining": quota.blocked.remaining.toString(),
        "X-RateLimit-Reset": Math.ceil(
          quota.blocked.resetAt.getTime() / 1000,
        ).toString(),
      },
    },
  );
