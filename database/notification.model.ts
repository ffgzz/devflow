import { Document, model, models, Schema, Types } from "mongoose";

export const NotificationTypeValues = [
  "answer_created",
  "answer_accepted",
] as const;

export type NotificationType = (typeof NotificationTypeValues)[number];

export interface INotification {
  type: NotificationType;
  recipient: Types.ObjectId;
  actor: Types.ObjectId;
  question: Types.ObjectId;
  answer: Types.ObjectId;
  dedupeKey: string;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDoc extends INotification, Document {}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: NotificationTypeValues,
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    question: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    answer: {
      type: Schema.Types.ObjectId,
      ref: "Answer",
      required: true,
    },
    dedupeKey: { type: String, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// The first two indexes serve the newest-first feed and unread count. The
// unique index makes retries and duplicate submissions idempotent per user.
NotificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index(
  { recipient: 1, dedupeKey: 1 },
  { unique: true },
);

const Notification =
  models.Notification ||
  model<INotification>("Notification", NotificationSchema);

export default Notification;
