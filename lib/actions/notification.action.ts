"use server";

import ROUTES from "@/constants/routes";
import Notification from "@/database/notification.model";
import { requireAuthenticatedUserId } from "@/lib/auth/authorization";
import {
  getNotificationSummary,
  type NotificationSummary,
} from "@/lib/dal/notification";
import handleError from "@/lib/handlers/error";
import { NotFoundError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const MarkNotificationReadSchema = z.object({
  notificationId: z
    .string()
    .regex(/^[0-9a-f]{24}$/iu, { message: "Invalid notification ID." }),
});

export interface MarkNotificationReadParams {
  notificationId: string;
}

export async function markNotificationRead(
  params: MarkNotificationReadParams,
): Promise<ActionResponse<{ readAt: string; unreadCount: number }>> {
  try {
    const { notificationId } = MarkNotificationReadSchema.parse(params);
    const recipientId = await requireAuthenticatedUserId();
    await dbConnect();

    const readAt = new Date();
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: recipientId },
      { $set: { readAt } },
      { new: true },
    ).select("_id");

    if (!notification) throw new NotFoundError("Notification");
    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      readAt: null,
    });

    revalidatePath(ROUTES.NOTIFICATIONS);

    return {
      success: true,
      data: { readAt: readAt.toISOString(), unreadCount },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function markAllNotificationsRead(): Promise<
  ActionResponse<{ readAt: string; updatedCount: number; unreadCount: number }>
> {
  try {
    const recipientId = await requireAuthenticatedUserId();
    await dbConnect();

    const readAt = new Date();
    const result = await Notification.updateMany(
      { recipient: recipientId, readAt: null },
      { $set: { readAt } },
    );
    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      readAt: null,
    });

    revalidatePath(ROUTES.NOTIFICATIONS);

    return {
      success: true,
      data: {
        readAt: readAt.toISOString(),
        updatedCount: result.modifiedCount,
        unreadCount,
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function refreshNotificationSummary(): Promise<
  ActionResponse<NotificationSummary>
> {
  try {
    return { success: true, data: await getNotificationSummary(8) };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}
