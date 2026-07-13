"use client";

import { createAnswer } from "@/lib/actions/answer.action";
import { api } from "@/lib/api";
import { AnswerSchema } from "@/lib/validations";
import { useIndexedDbDraft } from "@/hooks/useIndexedDbDraft";
import { zodResolver } from "@hookform/resolvers/zod";
import { MDXEditorMethods } from "@mdxeditor/editor";
import { Loader2Icon } from "lucide-react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import DraftStatus from "./DraftStatus";
import { Button } from "../ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "../ui/field";

// MDXEditor 不支持服务端渲染，因此必须保证编辑器组件仅在客户端渲染。
// 实现方式：使用 Next.js 的 dynamic 工具，并配置 { ssr: false }。
// dynamic 是 Next.js 提供的动态加载组件的方法。
const Editor = dynamic(() => import("@/components/editor"), {
  ssr: false,
});

interface Props {
  questionId: string;
  questionTitle: string;
  questionContent: string;
}

const AnswerForm = ({ questionId, questionTitle, questionContent }: Props) => {
  const [isAnswering, startAnsweringTransition] = useTransition();
  const [isAISubmitting, setIsAISubmitting] = useState(false);
  const session = useSession();

  const editorRef = useRef<MDXEditorMethods>(null);
  const draftOwnerRef = useRef<string | undefined>(undefined);
  const [editorRevision, setEditorRevision] = useState(0);

  const form = useForm<z.infer<typeof AnswerSchema>>({
    resolver: zodResolver(AnswerSchema),
    defaultValues: {
      content: "",
    },
  });

  const watchedContent = useWatch({
    control: form.control,
    name: "content",
  });
  const draftData = useMemo(
    () => ({ content: watchedContent ?? "" }),
    [watchedContent],
  );
  const {
    status: draftStatus,
    pendingDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
  } = useIndexedDbDraft({
    userId: session.data?.user?.id,
    kind: "answer",
    resourceId: questionId,
    data: draftData,
    enabled: session.status === "authenticated",
    shouldPersist: draftData.content.length > 0,
  });

  // Never carry user A's in-memory answer into user B's draft key when an
  // account changes without a full page navigation.
  useEffect(() => {
    if (session.status === "loading") return;
    const nextOwner = session.data?.user?.id;
    if (draftOwnerRef.current && draftOwnerRef.current !== nextOwner) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        form.reset({ content: "" });
        editorRef.current?.setMarkdown("");
        setEditorRevision((revision) => revision + 1);
      });
      draftOwnerRef.current = nextOwner;

      return () => {
        cancelled = true;
      };
    }
    draftOwnerRef.current = nextOwner;
  }, [form, session.data?.user?.id, session.status]);

  const handleRestoreDraft = () => {
    const draft = restoreDraft();
    if (!draft || typeof draft.content !== "string") {
      toast.error("This draft could not be restored.");
      void discardDraft();
      return;
    }

    form.reset({ content: draft.content });
    setEditorRevision((revision) => revision + 1);
  };

  const handleSubmit = async (values: z.infer<typeof AnswerSchema>) => {
    const requestOwner = session.data?.user?.id;
    // startTransition 的作用是：把某些状态更新标记成 低优先级更新。这样可以不阻塞用户界面，让用户在等待结果的同时还能继续进行其他操作。
    startAnsweringTransition(async () => {
      const result = await createAnswer({
        questionId,
        content: values.content,
      });
      if (draftOwnerRef.current !== requestOwner) return;

      if (result.success) {
        form.reset();

        if (editorRef.current) {
          editorRef.current.setMarkdown("");
        }
        await clearDraft({ resume: true });
        if (draftOwnerRef.current !== requestOwner) return;

        toast.success("Success", {
          description: "Your answer has been posted.",
          position: "top-center",
        });

      } else {
        toast.error("Failed to post answer", {
          description: result.errors?.message,
          position: "top-center",
        });
      }
    });
  };

  const generateAIAnswer = async () => {
    // 如果用户未认证，我们就使用 toast 提示用户需要登录才能使用 AI 回答生成功能。toast 是一个流行的 React 通知库，用于显示临时消息。
    if (session.status !== "authenticated") {
      return toast.error("please log in", {
        position: "top-center",
        description:
          "You need to be logged in to use the AI answer generation feature.",
      });
    }
    // 设置 isAISubmitting 状态为 true，表示 AI 回答正在生成中。这通常会触发界面上的加载状态，例如禁用按钮和显示加载动画，以防止用户在等待 AI 生成回答时进行其他操作。
    setIsAISubmitting(true);
    const requestOwner = session.data.user?.id;
    // 获取用户在编辑器中输入的内容
    const userAnswer = editorRef.current?.getMarkdown();

    try {
      const { success, data, errors } = await api.ai.getAnswer(
        questionTitle,
        questionContent,
        userAnswer,
      );
      if (draftOwnerRef.current !== requestOwner) return;

      if (!success) {
        return toast.error("Failed to generate AI answer", {
          position: "top-center",
          description: errors?.message,
        });
      }

      const formattedAnswer = data?.replace(/<br>/g, "").trim();
      if (!formattedAnswer) {
        return toast.error("Failed to generate AI answer", {
          position: "top-center",
          description: "The AI response was empty.",
        });
      }

      if (editorRef.current) {
        editorRef.current.setMarkdown(formattedAnswer);
        // 将 AI 生成的回答设置到表单中。form.setValue 的作用是：手动设置表单字段的值。在这里，我们把 AI 生成的回答设置到 content 字段中。
        form.setValue("content", formattedAnswer, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      toast.success("AI answer generated", {
        description: "The AI-generated answer has been added to the editor.",
        position: "top-center",
      });
    } catch (error) {
      if (draftOwnerRef.current !== requestOwner) return;
      return toast.error("Failed to generate AI answer", {
        position: "top-center",
        description:
          error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsAISubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center sm:gap-2">
        <h4
          id="answer-editor-label"
          className="paragraph-semibold text-dark400_light800"
        >
          Write your answer here
        </h4>
        <Button
          className="btn light-border-2 gap-1.5 rounded-md border px-4 py-2.5 text-primary-500 shadow-none "
          disabled={isAISubmitting || isAnswering}
          onClick={generateAIAnswer}
        >
          {isAISubmitting ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Image
                src="/icons/stars.svg"
                alt="Generate AI Answer"
                width={12}
                height={12}
                className="object-contain"
              />
              Generate AI Answer
            </>
          )}
        </Button>
      </div>

      <form
        className="mt-6 flex w-full flex-col gap-10"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <DraftStatus
          status={draftStatus}
          pendingUpdatedAt={pendingDraft?.updatedAt}
          onRestore={handleRestoreDraft}
          onDiscard={discardDraft}
        />

        <FieldGroup>
          <Controller
            control={form.control}
            name="content"
            render={({ field, fieldState }) => (
              <Field aria-labelledby="answer-editor-label">
                <FieldContent>
                  <Editor
                    key={editorRevision}
                    value={field.value}
                    editorRef={editorRef}
                    fieldChange={field.onChange}
                  />
                  <FieldDescription className="body-regular mt-2.5 text-light-500">
                    Provide a detailed answer with at least 100 characters.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />
        </FieldGroup>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isAnswering || isAISubmitting}
            className="primary-gradient w-fit"
          >
            {isAnswering ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              "Post Answer"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AnswerForm;
