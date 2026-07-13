"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import type { NotificationDTO } from "@/lib/dal/notification";
import { cn, getTimeStamp } from "@/lib/utils";
import { CheckCircle2, MessageCircleMore } from "lucide-react";
import { ComponentProps, forwardRef } from "react";

interface NotificationRowProps
  extends Omit<ComponentProps<"button">, "children"> {
  notification: NotificationDTO;
  onOpen: (notification: NotificationDTO) => void | Promise<void>;
  compact?: boolean;
}

const NotificationRow = forwardRef<HTMLButtonElement, NotificationRowProps>(
  function NotificationRow(
    {
      notification,
      onOpen,
      compact = false,
      disabled = false,
      className,
      onClick,
      ...buttonProps
    },
    ref,
  ) {
    const isUnread = notification.readAt === null;
    const isAnswerCreated = notification.type === "answer_created";
    const initials =
      notification.actor.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U";

    return (
      <button
        {...buttonProps}
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) void onOpen(notification);
        }}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg text-left transition-colors hover:bg-light-800 disabled:cursor-wait disabled:opacity-70 dark:hover:bg-dark-300",
          compact ? "px-3 py-3" : "light-border border p-4",
          isUnread && "bg-primary-500/5",
          className,
        )}
        aria-label={`${notification.actor.name} ${
          isAnswerCreated ? "answered your question" : "accepted your answer"
        }: ${notification.question.title}.${isUnread ? " Unread." : ""}`}
      >
        <div className="relative shrink-0">
          <Avatar className={compact ? "size-9" : "size-10"}>
            {notification.actor.image && (
              <AvatarImage
                src={notification.actor.image}
                alt={notification.actor.name}
              />
            )}
            <AvatarFallback className="primary-gradient text-xs font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="background-light900_dark200 absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full ring-2 ring-white dark:ring-dark-200">
            {isAnswerCreated ? (
              <MessageCircleMore className="size-3 text-primary-500" />
            ) : (
              <CheckCircle2 className="size-3 text-green-600" />
            )}
          </span>
        </div>

        <span className="min-w-0 flex-1">
          <span className="small-regular text-dark400_light700 block">
            <strong className="small-semibold text-dark200_light900">
              {notification.actor.name}
            </strong>{" "}
            {isAnswerCreated
              ? "answered your question"
              : "accepted your answer"}
          </span>
          <span className="small-semibold text-dark300_light800 mt-1 block truncate">
            {notification.question.title}
          </span>
          <span className="subtle-regular text-dark400_light500 mt-1 block">
            {getTimeStamp(new Date(notification.createdAt))}
          </span>
        </span>

        {isUnread && (
          <span
            className="mt-2 size-2 shrink-0 rounded-full bg-primary-500"
            aria-label="Unread"
          />
        )}
      </button>
    );
  },
);

export default NotificationRow;
