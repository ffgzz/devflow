"use client";

import NotificationRow from "@/components/notifications/NotificationRow";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ROUTES from "@/constants/routes";
import {
  markAllNotificationsRead,
  markNotificationRead,
  refreshNotificationSummary,
} from "@/lib/actions/notification.action";
import type { NotificationDTO } from "@/lib/dal/notification";
import {
  applyNotificationChange,
  publishNotificationChange,
  subscribeToNotificationChanges,
} from "@/lib/notifications/client-events";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface NotificationBellProps {
  initialNotifications: NotificationDTO[];
  initialUnreadCount: number;
}

const NotificationBell = ({
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) => {
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
          toast.error("Failed to mark the notification as read.", {
            description: result.errors?.message,
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
      toast.error("Failed to mark the notification as read.", {
        description: "Please check your connection and try again.",
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
        toast.error("Failed to mark all notifications as read.", {
          description: result.errors?.message,
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
      toast.error("Failed to mark all notifications as read.", {
        description: "Please check your connection and try again.",
      });
    } finally {
      operationInFlight.current = false;
      setIsBusy(false);
    }
  };

  const refreshSummary = async () => {
    if (operationInFlight.current) return;

    operationInFlight.current = true;
    setIsBusy(true);
    try {
      const result = await refreshNotificationSummary();
      if (result.success && result.data) {
        setNotificationState(result.data);
      } else {
        toast.error("Could not refresh notifications.", {
          description: result.errors?.message || "Please try again later.",
        });
      }
    } catch {
      toast.error("Could not refresh notifications.", {
        description: "Please check your connection and try again.",
      });
    } finally {
      operationInFlight.current = false;
      setIsBusy(false);
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refreshSummary();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell className="size-5 text-dark-400 dark:text-light-900" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="background-light900_dark200 w-[min(92vw,390px)] p-0"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="base-semibold text-dark200_light900">
              Notifications
            </p>
            <p className="subtle-regular text-dark400_light500">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy || unreadCount === 0}
            onClick={() => void markAllAsRead()}
            className="text-primary-500"
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        </div>

        <DropdownMenuSeparator className="m-0" />

        <div className="custom-scrollbar max-h-[420px] overflow-y-auto p-1">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification._id}
                asChild
                className="p-0 focus:bg-transparent"
              >
                <NotificationRow
                  notification={notification}
                  compact
                  disabled={isBusy}
                  onOpen={openNotification}
                />
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-5 py-10 text-center">
              <Bell className="mx-auto size-8 text-light-500" />
              <p className="small-semibold text-dark300_light800 mt-3">
                No notifications yet
              </p>
              <p className="subtle-regular text-dark400_light500 mt-1">
                New answers and accepted answers will show up here.
              </p>
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="justify-center p-0">
          <Link
            href={ROUTES.NOTIFICATIONS}
            className="small-semibold block w-full px-4 py-3 text-center text-primary-500"
          >
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
