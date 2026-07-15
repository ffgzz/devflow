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
  bucketKey: string;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

interface RateLimitWindow {
  bucketKey: string;
  expiresAt: Date;
  now: number;
  resetAt: Date;
}

const getRateLimitWindow = (
  { identifier, scope, windowMs }: RateLimitOptions,
  now = Date.now(),
): RateLimitWindow => {
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = new Date(bucketStart + windowMs);

  return {
    bucketKey: `${scope}:${identifier}:${bucketStart}`,
    // Retain the bucket for one additional window so retry metadata remains
    // available while MongoDB's TTL cleanup runs asynchronously.
    expiresAt: new Date(resetAt.getTime() + windowMs),
    now,
    resetAt,
  };
};

const rateLimitResult = ({
  allowed,
  bucketKey,
  count,
  limit,
  now,
  resetAt,
}: {
  allowed: boolean;
  bucketKey: string;
  count: number;
  limit: number;
  now: number;
  resetAt: Date;
}): RateLimitResult => ({
  allowed,
  bucketKey,
  limit,
  remaining: Math.max(0, limit - count),
  retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
  resetAt,
});

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

const decrementBucket = (key: string) =>
  RateLimit.findOneAndUpdate(
    { key, count: { $gt: 0 } },
    { $inc: { count: -1 } },
    { new: true },
  )
    .select("count")
    .lean()
    .exec();

export async function consumeRateLimit({
  identifier,
  limit,
  scope,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  await dbConnect();
  await RateLimit.init();

  const window = getRateLimitWindow({ identifier, limit, scope, windowMs });
  const bucket = await incrementBucket(window.bucketKey, window.expiresAt);
  const count = bucket?.count ?? limit + 1;
  const allowed = count <= limit;

  if (!allowed) {
    // A rejected request should not make a hot bucket grow without bound.
    // Pair this exact denied increment with one decrement. Checking against
    // `limit` here would lose a decrement if another concurrent request was
    // refunded between our increment and rollback.
    await decrementBucket(window.bucketKey);
  }

  return rateLimitResult({
    allowed,
    bucketKey: window.bucketKey,
    count: allowed ? count : limit,
    limit,
    now: window.now,
    resetAt: window.resetAt,
  });
}

/**
 * Reads the active fixed-window bucket without consuming a request.
 * `allowed` answers whether the next request can be consumed right now.
 */
export async function peekRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  await dbConnect();
  await RateLimit.init();

  const window = getRateLimitWindow(options);
  const bucket = await RateLimit.findOne({ key: window.bucketKey })
    .select("count")
    .lean()
    .exec();
  const count = bucket?.count ?? 0;

  return rateLimitResult({
    allowed: count < options.limit,
    bucketKey: window.bucketKey,
    count,
    limit: options.limit,
    now: window.now,
    resetAt: window.resetAt,
  });
}

/**
 * Reverses one previously consumed request without ever allowing a bucket to
 * become negative. The key comes from the corresponding RateLimitResult so a
 * refund cannot accidentally target a newer fixed window.
 */
export async function refundRateLimit(bucketKey: string): Promise<boolean> {
  if (!bucketKey) return false;

  await dbConnect();
  await RateLimit.init();

  const bucket = await decrementBucket(bucketKey);

  return bucket !== null;
}
