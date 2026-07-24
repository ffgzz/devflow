"use client";

import NotificationRow from "@/components/notifications/NotificationRow";
import { Button } from "@/components/ui/button";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notification.action";
import type { NotificationDTO } from "@/lib/dal/notification";
import {
  applyNotificationChange,
  publishNotificationChange,
  subscribeToNotificationChanges,
} from "@/lib/notifications/client-events";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client";

interface NotificationPageListProps {
  initialNotifications: NotificationDTO[];
  initialUnreadCount: number;
}

const NotificationPageList = ({
  initialNotifications,
  initialUnreadCount,
}: NotificationPageListProps) => {
  const { t } = useI18n();
  const router = useRouter();
  const [notificationState, setNotificationState] = useState({
    notifications: initialNotifications,
    unreadCount: initialUnreadCount,
  });
  const [isBusy, setIsBusy] = useState(false);
  const operationInFlight = useRef(false);
  const { notifications, unreadCount } = notificationState;

  useEffect(
    () =>
      subscribeToNotificationChanges((change) => {
        setNotificationState((current) =>
          applyNotificationChange(current, change),
        );
      }),
    [],
  );

  const openNotification = async (notification: NotificationDTO) => {
    if (operationInFlight.current) return;

    const wasUnread = notification.readAt === null;
    operationInFlight.current = true;
    setIsBusy(true);

    try {
      if (wasUnread) {
        const result = await markNotificationRead({
          notificationId: notification._id,
        });

        if (!result.success || !result.data) {
          toast.error(t("Failed to mark the notification as read."), {
            description: result.errors?.message ? t(result.errors.message) : undefined,
          });
        } else {
          const change = {
            type: "read" as const,
            notificationId: notification._id,
            readAt: result.data.readAt,
            unreadCount: result.data.unreadCount,
          };
          setNotificationState((current) =>
            applyNotificationChange(current, change),
          );
          publishNotificationChange(change);
        }
      }
    } catch {
      toast.error(t("Failed to mark the notification as read."), {
        description: t("Please check your connection and try again."),
      });
    } finally {
      operationInFlight.current = false;
      setIsBusy(false);
    }

    router.push(notification.href);
  };

  const markAllAsRead = async () => {
    if (operationInFlight.current || unreadCount === 0) return;

    operationInFlight.current = true;
    setIsBusy(true);

    try {
      const result = await markAllNotificationsRead();

      if (!result.success || !result.data) {
        toast.error(t("Failed to mark all notifications as read."), {
          description: result.errors?.message ? t(result.errors.message) : undefined,
        });
      } else {
        const change = {
          type: "all-read" as const,
          readAt: result.data.readAt,
          unreadCount: result.data.unreadCount,
        };
        setNotificationState((current) =>
          applyNotificationChange(current, change),
        );
        publishNotificationChange(change);
      }
    } catch {
      toast.error(t("Failed to mark all notifications as read."), {
        description: t("Please check your connection and try again."),
      });
    } finally {
      operationInFlight.current = false;
      setIsBusy(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="small-regular text-dark400_light500">
          {unreadCount > 0
            ? t("{count} unread notifications", { count: unreadCount })
            : t("You're all caught up")}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={isBusy || unreadCount === 0}
          onClick={() => void markAllAsRead()}
        >
          <CheckCheck className="size-4" />
          {t("Mark all as read")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {notifications.map((notification) => (
          <NotificationRow
            key={notification._id}
            notification={notification}
            disabled={isBusy}
            onOpen={openNotification}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationPageList;
