"use client";

import { setQuestionSaved } from "@/lib/actions/collection.action";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

// 收藏问题
const SaveQuestion = ({
  questionId,
  hasSavedQuestionPromise,
}: {
  questionId: string;
  hasSavedQuestionPromise: Promise<ActionResponse<{ saved: boolean }>>;
}) => {
  // useSession() 是客户端 Hook，只能在 Client Component 里用
  // 而 auth 是服务端函数，只能在 Server Component 里用
  const session = useSession();
  const userId = session.data?.user?.id;

  // use() 是 React 提供的一个 Hook，用于在组件中处理异步数据。
  // 它允许我们直接在组件的渲染过程中等待一个 Promise 的结果，并且在 Promise 解决后自动触发组件的重新渲染。
  const { data } = use(hasSavedQuestionPromise);
  const { saved: hasSaved } = data || {};

  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(Boolean(hasSaved));

  useEffect(() => {
    setSaved(Boolean(hasSaved));
  }, [hasSaved]);

  const handleSave = async () => {
    if (isLoading) return;
    if (!userId) return toast.error("You must be logged in to save questions");

    const previousSaved = saved;
    const nextSaved = !previousSaved;
    setSaved(nextSaved);
    setIsLoading(true);
    try {
      const { success, data, errors } = await setQuestionSaved({
        questionId,
        saved: nextSaved,
      });
      if (!success || !data) {
        setSaved(previousSaved);
        throw new Error(errors?.message || "Failed to save question");
      }

      setSaved(data.saved);

      toast.success(
        `Question ${data.saved ? "saved to" : "removed from"} your collection successfully!`,
        {
          position: "top-center",
        },
      );
    } catch (error) {
      setSaved(previousSaved);
      toast.error("question", {
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        position: "top-center",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={saved ? "Remove question from collection" : "Save question"}
      aria-pressed={saved}
      disabled={isLoading || session.status === "loading"}
      className="flex size-8 items-center justify-center rounded-sm disabled:cursor-not-allowed disabled:opacity-50"
      onClick={() => void handleSave()}
    >
      <Image
        src={saved ? "/icons/star-filled.svg" : "/icons/star-red.svg"}
        alt=""
        width={18}
        height={18}
      />
    </button>
  );
};

export default SaveQuestion;
