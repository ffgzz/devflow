import "server-only";

import {
  consumeRateLimit,
  peekRateLimit,
  refundRateLimit,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { AIQuotaSchema, type AIQuota } from "@/lib/ai/question-analysis-schema";
import { NextResponse } from "next/server";
import { positiveIntegerFromEnv } from "./provider";

interface AIQuotaBuckets {
  hour: RateLimitResult;
  day: RateLimitResult;
}

interface AllowedAIQuota extends AIQuotaBuckets {
  allowed: true;
}

interface BlockedAIQuota extends AIQuotaBuckets {
  allowed: false;
  scope: "hour" | "day";
  blocked: RateLimitResult;
}

export type AIQuotaResult = AllowedAIQuota | BlockedAIQuota;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const quotaOptions = (userId: string) => ({
  hour: {
    identifier: userId,
    limit: positiveIntegerFromEnv("AI_RATE_LIMIT_PER_HOUR", 10),
    scope: "ai-hour",
    windowMs: HOUR_MS,
  },
  day: {
    identifier: userId,
    limit: positiveIntegerFromEnv("AI_RATE_LIMIT_PER_DAY", 30),
    scope: "ai-day",
    windowMs: DAY_MS,
  },
});

export const toAIQuotaData = ({ hour, day }: AIQuotaBuckets): AIQuota =>
  AIQuotaSchema.parse({
    hourLimit: hour.limit,
    hourRemaining: hour.remaining,
    hourResetAt: hour.resetAt.toISOString(),
    dayLimit: day.limit,
    dayRemaining: day.remaining,
    dayResetAt: day.resetAt.toISOString(),
  });

export async function getAIQuotaSnapshot(userId: string): Promise<AIQuota> {
  const options = quotaOptions(userId);
  const [hour, day] = await Promise.all([
    peekRateLimit(options.hour),
    peekRateLimit(options.day),
  ]);

  return toAIQuotaData({ hour, day });
}

export async function consumeAIQuota(userId: string): Promise<AIQuotaResult> {
  const options = quotaOptions(userId);
  const hour = await consumeRateLimit(options.hour);
  if (!hour.allowed) {
    const day = await peekRateLimit(options.day);
    // When both windows are exhausted, the user cannot retry until the later
    // one resets. Report that bucket so Retry-After never unlocks the UI early.
    const dayBlocksLonger =
      !day.allowed && day.resetAt.getTime() > hour.resetAt.getTime();
    return dayBlocksLonger
      ? { allowed: false, scope: "day", blocked: day, hour, day }
      : { allowed: false, scope: "hour", blocked: hour, hour, day };
  }

  let day: RateLimitResult;
  try {
    day = await consumeRateLimit(options.day);
  } catch (error) {
    await refundRateLimit(hour.bucketKey);
    throw error;
  }

  if (!day.allowed) {
    await refundRateLimit(hour.bucketKey);
    const restoredHour = await peekRateLimit(options.hour);
    return {
      allowed: false,
      scope: "day",
      blocked: day,
      hour: restoredHour,
      day,
    };
  }

  return { allowed: true, hour, day };
}

export const quotaHeaders = (quota: AIQuotaBuckets) => ({
  "X-RateLimit-Limit": quota.day.limit.toString(),
  "X-RateLimit-Remaining": quota.day.remaining.toString(),
  "X-RateLimit-Reset": Math.ceil(quota.day.resetAt.getTime() / 1000).toString(),
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
        resetAt: quota.blocked.resetAt.toISOString(),
        quota: toAIQuotaData(quota),
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
        "X-RateLimit-Hour-Remaining": quota.hour.remaining.toString(),
        "X-RateLimit-Day-Remaining": quota.day.remaining.toString(),
        "Cache-Control": "private, no-store",
      },
    },
  );
