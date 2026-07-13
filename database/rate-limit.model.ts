import { model, models, Schema } from "mongoose";

export interface IRateLimit {
  key: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// MongoDB removes expired buckets automatically. A second window of retention
// is used by the caller so a request can still report an accurate retry time.
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit =
  models.RateLimit || model<IRateLimit>("RateLimit", RateLimitSchema);

export default RateLimit;
