"use client";

import { setVote } from "@/lib/actions/vote.action";
import { formatNumber } from "@/lib/utils";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { use, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
  targetId: string;
  targetType: "question" | "answer";
  upvotes: number;
  downvotes: number;
  targetAuthorId: string;
  hasVotedPromise: Promise<ActionResponse<HasVotedResponse>>;
}

const Votes = ({
  upvotes,
  downvotes,
  hasVotedPromise,
  targetId,
  targetType,
  targetAuthorId,
}: Props) => {
  const session = useSession();
  const userId = session.data?.user?.id;

  // 如果 Promise 还没完成，组件会 suspend，也就是暂停渲染，等待外层 <Suspense> 显示 fallback。
  // 如果 Promise reject，会交给最近的 Error Boundary 处理
  const { success, data } = use(hasVotedPromise);
  const { hasUpvoted, hasDownvoted } = data || {};

  const [isLoading, setIsLoading] = useState(false);
  const requestInFlight = useRef(false);
  const [voteState, setVoteState] = useState({
    upvotes,
    downvotes,
    hasUpvoted: Boolean(success && hasUpvoted),
    hasDownvoted: Boolean(success && hasDownvoted),
  });

  // A Server Action can return a refreshed RSC payload. Keep local state in
  // sync when the server snapshot itself changes.
  useEffect(() => {
    setVoteState({
      upvotes,
      downvotes,
      hasUpvoted: Boolean(success && hasUpvoted),
      hasDownvoted: Boolean(success && hasDownvoted),
    });
  }, [downvotes, hasDownvoted, hasUpvoted, success, upvotes]);

  const handleVote = async (type: "upvote" | "downvote") => {
    if (requestInFlight.current) return;
    if (!userId) {
      // 如果用户未登录，提示他们需要登录才能投票
      return toast.error("You need to be logged in to vote.", {
        description: "Please log in to cast your vote.",
      });
    }

    if (userId === targetAuthorId) {
      return toast.error("You cannot vote on your own content.");
    }

    requestInFlight.current = true;
    setIsLoading(true);
    const previousState = voteState;
    const wasActive =
      type === "upvote"
        ? previousState.hasUpvoted
        : previousState.hasDownvoted;
    const desiredVoteType = wasActive ? null : type;

    setVoteState((current) => {
      if (type === "upvote") {
        return current.hasUpvoted
          ? {
              ...current,
              hasUpvoted: false,
              upvotes: Math.max(0, current.upvotes - 1),
            }
          : {
              ...current,
              hasUpvoted: true,
              hasDownvoted: false,
              upvotes: current.upvotes + 1,
              downvotes: current.hasDownvoted
                ? Math.max(0, current.downvotes - 1)
                : current.downvotes,
            };
      }

      return current.hasDownvoted
        ? {
            ...current,
            hasDownvoted: false,
            downvotes: Math.max(0, current.downvotes - 1),
          }
        : {
            ...current,
            hasDownvoted: true,
            hasUpvoted: false,
            downvotes: current.downvotes + 1,
            upvotes: current.hasUpvoted
              ? Math.max(0, current.upvotes - 1)
              : current.upvotes,
          };
    });

    try {
      const result = await setVote({
        targetId,
        targetType,
        voteType: desiredVoteType,
      });
      if (!result.success || !result.data) {
        setVoteState(previousState);
        return toast.error("Failed to process your vote.", {
          description: result.errors?.message || "Please try again later.",
        });
      }

      // Reconcile the optimistic guess with the database result. This also
      // accounts for votes cast from another tab between render and click.
      setVoteState(result.data);

      const successMessage =
        type === "upvote"
          ? `Upvote ${desiredVoteType ? "added" : "removed"} successfully!`
          : `Downvote ${desiredVoteType ? "added" : "removed"} successfully!`;

      toast.success(successMessage, {
        position: "top-center",
      });
    } catch {
      setVoteState(previousState);
      toast.error("An error occurred while processing your vote.", {
        description: "Please try again later.",
      });
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-center gap-2.5">
      <div className="flex-center gap-1.5">
        <button
          type="button"
          aria-label="Upvote"
          aria-pressed={voteState.hasUpvoted}
          title={
            userId === targetAuthorId
              ? "You cannot vote on your own content"
              : "Upvote"
          }
          disabled={
            isLoading ||
            session.status === "loading" ||
            userId === targetAuthorId
          }
          className="flex size-8 items-center justify-center rounded-sm disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void handleVote("upvote")}
        >
          <Image
            src={
              voteState.hasUpvoted
                ? "/icons/upvoted.svg"
                : "/icons/upvote.svg"
            }
            alt=""
            width={18}
            height={18}
          />
        </button>

        <div className="flex-center background-light700_dark400 min-w-5 rounded-sm p-1">
          <p className="subtle-medium text-dark-400_kight900">
            {formatNumber(voteState.upvotes)}
          </p>
        </div>
      </div>

      <div className="flex-center gap-1.5">
        <button
          type="button"
          aria-label="Downvote"
          aria-pressed={voteState.hasDownvoted}
          title={
            userId === targetAuthorId
              ? "You cannot vote on your own content"
              : "Downvote"
          }
          disabled={
            isLoading ||
            session.status === "loading" ||
            userId === targetAuthorId
          }
          className="flex size-8 items-center justify-center rounded-sm disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void handleVote("downvote")}
        >
          <Image
            src={
              voteState.hasDownvoted
                ? "/icons/downvoted.svg"
                : "/icons/downvote.svg"
            }
            alt=""
            width={18}
            height={18}
          />
        </button>

        <div className="flex-center background-light700_dark400 min-w-5 rounded-sm p-1">
          <p className="subtle-medium text-dark-400_kight900">
            {formatNumber(voteState.downvotes)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Votes;
