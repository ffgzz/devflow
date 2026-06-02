"use client";

import { toggleSaveQuestion } from "@/lib/actions/collection.action";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { use, useState } from "react";
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

  const handleSave = async () => {
    if (isLoading) return; // 如果正在加载中，直接返回，避免重复点击
    if (!userId) return toast.error("You must be logged in to save questions");

    setIsLoading(true);
    try {
      const { success, data, errors } = await toggleSaveQuestion({
        questionId,
      });
      if (!success)
        throw new Error(errors?.message || "Failed to save question");

      toast.success(
        `Question ${data?.saved ? "saved to" : "removed from"} your collection successfully!`,
        {
          position: "top-center",
        },
      );
    } catch (error) {
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
    <Image
      src={hasSaved ? "/icons/star-filled.svg" : "/icons/star-red.svg"}
      alt="Save question"
      width={18}
      height={18}
      className={`cursor-pointer ${isLoading && "opacity-50"}`}
      aria-label="Save question"
      onClick={handleSave}
    />
  );
};

export default SaveQuestion;
