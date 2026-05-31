"use client";

import { createVote } from "@/lib/actions/vote.action";
import { formatNumber } from "@/lib/utils";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { use, useState } from "react";
import { toast } from "sonner";

interface Props {
  targetId: string;
  targetType: "question" | "answer";
  upvotes: number;
  downvotes: number;
  hasVotedPromise: Promise<ActionResponse<HasVotedResponse>>;
}

const Votes = ({
  upvotes,
  downvotes,
  hasVotedPromise,
  targetId,
  targetType,
}: Props) => {
  const session = useSession();
  const userId = session.data?.user?.id;

  // 如果 Promise 还没完成，组件会 suspend，也就是暂停渲染，等待外层 <Suspense> 显示 fallback。
  // 如果 Promise reject，会交给最近的 Error Boundary 处理
  const { success, data } = use(hasVotedPromise);
  const { hasUpvoted, hasDownvoted } = data || {};

  const [isLoading, setIsLoading] = useState(false);

  const handleVote = async (type: "upvote" | "downvote") => {
    if (!userId) {
      // 如果用户未登录，提示他们需要登录才能投票
      return toast.error("You need to be logged in to vote.", {
        description: "Please log in to cast your vote.",
      });
    }

    setIsLoading(true);

    try {
      const result = await createVote({
        targetId,
        targetType,
        voteType: type,
      });
      if (!result.success) {
        return toast.error("Failed to process your vote.", {
          description: result.errors?.message || "Please try again later.",
        });
      }

      const successMessage =
        type === "upvote"
          ? `Upvote ${!hasUpvoted ? "added" : "removed"} successfully!`
          : `Downvote ${!hasDownvoted ? "added" : "removed"} successfully!`;

      toast.success(successMessage, {
        position: "top-center",
      });
    } catch (error) {
      toast.error("An error occurred while processing your vote.", {
        description: "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-center gap-2.5">
      <div className="flex-center gap-1.5">
        <Image
          src={
            success && hasUpvoted ? "/icons/upvoted.svg" : "/icons/upvote.svg"
          }
          alt="Upvote"
          width={18}
          height={18}
          className={`cursor-pointer ${isLoading && "opacity-50"} `}
          aria-label="Upvote"
          onClick={() => {
            !isLoading && handleVote("upvote");
          }}
        />

        <div className="flex-center background-light700_dark400 min-w-5 rounded-sm p-1">
          <p className="subtle-medium text-dark-400_kight900">
            {formatNumber(upvotes)}
          </p>
        </div>
      </div>

      <div className="flex-center gap-1.5">
        <Image
          src={
            success && hasDownvoted
              ? "/icons/downvoted.svg"
              : "/icons/downvote.svg"
          }
          alt="Downvote"
          width={18}
          height={18}
          className={`cursor-pointer ${isLoading && "opacity-50"} `}
          // aria-label="Upvote" 是给辅助技术看的，比如屏幕阅读器
          aria-label="Downvote"
          onClick={() => {
            !isLoading && handleVote("downvote");
          }}
        />

        <div className="flex-center background-light700_dark400 min-w-5 rounded-sm p-1">
          <p className="subtle-medium text-dark-400_kight900">
            {formatNumber(downvotes)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Votes;
