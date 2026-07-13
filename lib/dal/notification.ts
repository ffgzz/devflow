import "server-only";

import ROUTES from "@/constants/routes";
import Notification from "@/database/notification.model";
import type { NotificationType } from "@/database/notification.model";
import { requireAuthenticatedUserId } from "@/lib/auth/authorization";
import { dbConnect } from "@/lib/mongoose";
import type { ClientSession } from "mongoose";
import { PipelineStage, Types } from "mongoose";

type ObjectIdLike = string | Types.ObjectId;

export interface NotificationDTO {
  _id: string;
  type: NotificationType;
  actor: {
    _id: string;
    name: string;
    image?: string;
  };
  question: {
    _id: string;
    title: string;
  };
  answerId: string;
  href: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationSummary {
  notifications: NotificationDTO[];
  unreadCount: number;
}

export interface NotificationPage extends NotificationSummary {
  isNext: boolean;
  total: number;
}

interface NotificationAggregateRow {
  _id: Types.ObjectId;
  type: NotificationType;
  actor: {
    _id: Types.ObjectId;
    name: string;
    image?: string;
  };
  question: {
    _id: Types.ObjectId;
    title: string;
  };
  answer: Types.ObjectId;
  readAt?: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  type: NotificationType;
  recipientId: ObjectIdLike;
  actorId: ObjectIdLike;
  questionId: ObjectIdLike;
  answerId: ObjectIdLike;
}

const makeDedupeKey = (type: NotificationType, answerId: ObjectIdLike) =>
  `${type}:${answerId.toString()}`;

const serializeNotification = (
  notification: NotificationAggregateRow,
): NotificationDTO => {
  const questionId = notification.question._id.toString();
  const answerId = notification.answer.toString();

  return {
    _id: notification._id.toString(),
    type: notification.type,
    actor: {
      _id: notification.actor._id.toString(),
      name: notification.actor.name,
      image: notification.actor.image,
    },
    question: {
      _id: questionId,
      title: notification.question.title,
    },
    answerId,
    href: `${ROUTES.QUESTION(questionId)}?answer=${encodeURIComponent(answerId)}#answer-${answerId}`,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
};

const notificationPipeline = (
  recipientId: string,
  skip: number,
  limit: number,
): PipelineStage[] => [
  { $match: { recipient: new Types.ObjectId(recipientId) } },
  { $sort: { createdAt: -1, _id: -1 } },
  { $skip: skip },
  { $limit: limit },
  {
    $lookup: {
      from: "users",
      localField: "actor",
      foreignField: "_id",
      as: "actor",
      pipeline: [{ $project: { name: 1, image: 1 } }],
    },
  },
  { $unwind: "$actor" },
  {
    $lookup: {
      from: "questions",
      localField: "question",
      foreignField: "_id",
      as: "question",
      pipeline: [{ $project: { title: 1 } }],
    },
  },
  { $unwind: "$question" },
];

async function findNotifications(
  recipientId: string,
  skip: number,
  limit: number,
) {
  const notifications = await Notification.aggregate<NotificationAggregateRow>(
    notificationPipeline(recipientId, skip, limit),
  );

  return notifications.map(serializeNotification);
}

export async function getNotificationSummary(
  limit = 8,
): Promise<NotificationSummary> {
  const recipientId = await requireAuthenticatedUserId();
  await dbConnect();

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const [notifications, unreadCount] = await Promise.all([
    findNotifications(recipientId, 0, safeLimit),
    Notification.countDocuments({ recipient: recipientId, readAt: null }),
  ]);

  return { notifications, unreadCount };
}

export async function getNotifications({
  page = 1,
  pageSize = 20,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<NotificationPage> {
  const recipientId = await requireAuthenticatedUserId();
  await dbConnect();

  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const safePageSize =
    Number.isSafeInteger(pageSize) && pageSize > 0
      ? Math.min(pageSize, 50)
      : 20;
  const skip = (safePage - 1) * safePageSize;

  const [notifications, total, unreadCount] = await Promise.all([
    findNotifications(recipientId, skip, safePageSize),
    Notification.countDocuments({ recipient: recipientId }),
    Notification.countDocuments({ recipient: recipientId, readAt: null }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    isNext: skip + notifications.length < total,
  };
}

/**
 * Writes a user-visible domain event. Call this from the same transaction that
 * creates the answer or changes its accepted state.
 */
export async function createNotification(
  input: CreateNotificationInput,
  session?: ClientSession,
) {
  if (input.recipientId.toString() === input.actorId.toString()) return;

  const dedupeKey = makeDedupeKey(input.type, input.answerId);

  await Notification.updateOne(
    { recipient: input.recipientId, dedupeKey },
    {
      $setOnInsert: {
        type: input.type,
        recipient: input.recipientId,
        actor: input.actorId,
        question: input.questionId,
        answer: input.answerId,
        dedupeKey,
        readAt: null,
      },
    },
    { upsert: true, session },
  );
}

export async function deleteNotificationEvent(
  type: NotificationType,
  answerId: ObjectIdLike,
  session?: ClientSession,
) {
  await Notification.deleteMany({ type, answer: answerId }).session(
    session ?? null,
  );
}

export async function deleteNotificationsForAnswer(
  answerId: ObjectIdLike,
  session?: ClientSession,
) {
  await Notification.deleteMany({ answer: answerId }).session(session ?? null);
}

export async function deleteNotificationsForQuestion(
  questionId: ObjectIdLike,
  session?: ClientSession,
) {
  await Notification.deleteMany({ question: questionId }).session(
    session ?? null,
  );
}
