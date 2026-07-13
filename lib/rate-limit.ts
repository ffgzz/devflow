import "server-only";

import RateLimit from "@/database/rate-limit.model";
import { dbConnect } from "@/lib/mongoose";

interface RateLimitOptions {
  identifier: string;
  limit: number;
  scope: string;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

const incrementBucket = async (key: string, expiresAt: Date) => {
  try {
    return await RateLimit.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt },
      },
      { new: true, upsert: true },
    ).lean();
  } catch (error) {
    // Two first requests can race while creating the same unique bucket.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Error & { code?: number }).code === 11000
    ) {
      return RateLimit.findOneAndUpdate(
        { key },
        { $inc: { count: 1 } },
        { new: true },
      ).lean();
    }

    throw error;
  }
};

export async function consumeRateLimit({
  identifier,
  limit,
  scope,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  await dbConnect();
  await RateLimit.init();

  const now = Date.now();
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = bucketStart + windowMs;
  const key = `${scope}:${identifier}:${bucketStart}`;
  const bucket = await incrementBucket(
    key,
    // Retain the bucket for one additional window so retry metadata remains
    // available while MongoDB's TTL cleanup runs asynchronously.
    new Date(resetAt + windowMs),
  );
  const count = bucket?.count ?? limit + 1;

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    resetAt: new Date(resetAt),
  };
}
