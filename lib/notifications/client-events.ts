"use client";

import type { NotificationDTO } from "@/lib/dal/notification";

export type NotificationClientChange =
  | {
      type: "read";
      notificationId: string;
      readAt: string;
      unreadCount?: number;
    }
  | { type: "all-read"; readAt: string; unreadCount?: number };

export interface NotificationClientState {
  notifications: NotificationDTO[];
  unreadCount: number;
}

const WINDOW_EVENT = "devflow:notification-change";
const CHANNEL_NAME = "devflow-notifications";

export function applyNotificationChange(
  state: NotificationClientState,
  change: NotificationClientChange,
): NotificationClientState {
  if (change.type === "all-read") {
    return {
      unreadCount: change.unreadCount ?? 0,
      notifications: state.notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? change.readAt,
      })),
    };
  }

  const target = state.notifications.find(
    (notification) => notification._id === change.notificationId,
  );
  const shouldUpdateTarget = Boolean(target && target.readAt === null);
  const nextUnreadCount =
    change.unreadCount ??
    (shouldUpdateTarget
      ? Math.max(0, state.unreadCount - 1)
      : state.unreadCount);

  if (!shouldUpdateTarget && nextUnreadCount === state.unreadCount) {
    return state;
  }

  return {
    unreadCount: nextUnreadCount,
    notifications: shouldUpdateTarget
      ? state.notifications.map((notification) =>
          notification._id === change.notificationId
            ? { ...notification, readAt: change.readAt }
            : notification,
        )
      : state.notifications,
  };
}

export function publishNotificationChange(change: NotificationClientChange) {
  window.dispatchEvent(new CustomEvent(WINDOW_EVENT, { detail: change }));

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(change);
    channel.close();
  }
}

export function subscribeToNotificationChanges(
  listener: (change: NotificationClientChange) => void,
) {
  const handleWindowEvent = (event: Event) => {
    listener((event as CustomEvent<NotificationClientChange>).detail);
  };
  window.addEventListener(WINDOW_EVENT, handleWindowEvent);

  const channel =
    "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  if (channel) {
    channel.onmessage = (event: MessageEvent<NotificationClientChange>) => {
      listener(event.data);
    };
  }

  return () => {
    window.removeEventListener(WINDOW_EVENT, handleWindowEvent);
    channel?.close();
  };
}
