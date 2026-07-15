"use client";

import { AskQuestionSchema } from "@/lib/validations";
// zodResolver 是连接 Zod校验规则 和 React Hook Form 的桥梁
import ROUTES from "@/constants/routes";
import { useIndexedDbDraft } from "@/hooks/useIndexedDbDraft";
import { createQuestion, editQuestion } from "@/lib/actions/question.action";
import type {
  DraftEditMutation,
  DraftMutationResult,
} from "@/lib/ai/draft-edit-types";
import {
  QuestionWorkbenchDraftSchema,
  type QuestionWorkbenchDraft,
} from "@/lib/ai/question-analysis-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { MDXEditorMethods } from "@mdxeditor/editor";
import { Loader2Icon } from "lucide-react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Controller,
  ControllerRenderProps,
  useForm,
  useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import TagCard from "../cards/TagCard";
import AIQuestionWorkbench from "../questions/AIQuestionWorkbench";
import DraftStatus from "./DraftStatus";
import { Button } from "../ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../ui/field";
import { Input } from "../ui/input";

// MDXEditor 不支持服务端渲染，因此必须保证编辑器组件仅在客户端渲染。
// 实现方式：使用 Next.js 的 dynamic 工具，并配置 { ssr: false }。
const Editor = dynamic(() => import("@/components/editor"), {
  ssr: false,
});

interface Params {
  question?: Question;
  isEdit?: boolean;
}

interface QuestionDraftData {
  title: string;
  content: string;
  tags: string[];
  tagInput: string;
}

const isSameWorkbenchDraft = (
  left: QuestionWorkbenchDraft,
  right: QuestionWorkbenchDraft,
) =>
  left.title === right.title &&
  left.content === right.content &&
  left.questionId === right.questionId &&
  left.tags.length === right.tags.length &&
  left.tags.every((tag, index) => tag === right.tags[index]);

const QuestionForm = ({ question, isEdit = false }: Params) => {
  const router = useRouter();
  const session = useSession();
  const editorRef = useRef<MDXEditorMethods>(null);
  const draftOwnerRef = useRef<string | undefined>(undefined);
  const [editorRevision, setEditorRevision] = useState(0);
  const [tagInput, setTagInput] = useState("");
  // useTransition() 是 React 提供的一个 Hook，用来把某些状态更新标记成 低优先级更新。
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof AskQuestionSchema>>({
    resolver: zodResolver(AskQuestionSchema),
    defaultValues: {
      title: question?.title || "",
      content: question?.content || "",
      tags: question?.tags.map((tag) => tag.name) || [],
    },
  });

  const watchedValues = useWatch({ control: form.control });
  const draftData = useMemo<QuestionDraftData>(
    () => ({
      title: watchedValues.title ?? "",
      content: watchedValues.content ?? "",
      tags:
        watchedValues.tags?.filter(
          (tag): tag is string => typeof tag === "string",
        ) ?? [],
      tagInput,
    }),
    [tagInput, watchedValues.content, watchedValues.tags, watchedValues.title],
  );
  const shouldPersistDraft = useMemo(() => {
    const initialTags = question?.tags.map((tag) => tag.name) ?? [];

    return (
      draftData.title !== (question?.title ?? "") ||
      draftData.content !== (question?.content ?? "") ||
      draftData.tagInput.length > 0 ||
      JSON.stringify(draftData.tags) !== JSON.stringify(initialTags)
    );
  }, [draftData, question]);
  const {
    status: draftStatus,
    pendingDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
  } = useIndexedDbDraft({
    userId: session.data?.user?.id,
    kind: "question",
    resourceId: isEdit && question ? question._id : "new",
    data: draftData,
    enabled: session.status === "authenticated",
    shouldPersist: shouldPersistDraft,
  });

  // A client-side account switch must not carry user A's in-memory question
  // into user B's IndexedDB key. Reset to the server snapshot at the account
  // boundary; the new account can then restore only its own stored draft.
  useEffect(() => {
    if (session.status === "loading") return;

    const nextOwner = session.data?.user?.id;
    if (draftOwnerRef.current && draftOwnerRef.current !== nextOwner) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        const initialContent = question?.content ?? "";
        form.reset({
          title: question?.title ?? "",
          content: initialContent,
          tags: question?.tags.map((tag) => tag.name) ?? [],
        });
        setTagInput("");
        editorRef.current?.setMarkdown(initialContent);
        setEditorRevision((revision) => revision + 1);
      });
      draftOwnerRef.current = nextOwner;

      return () => {
        cancelled = true;
      };
    }
    draftOwnerRef.current = nextOwner;
  }, [form, question, session.data?.user?.id, session.status]);

  const handleRestoreDraft = () => {
    const draft = restoreDraft();
    if (
      !draft ||
      typeof draft.title !== "string" ||
      typeof draft.content !== "string" ||
      !Array.isArray(draft.tags)
    ) {
      toast.error("This draft could not be restored.");
      void discardDraft();
      return;
    }

    form.reset({
      title: draft.title,
      content: draft.content,
      tags: draft.tags.filter((tag) => typeof tag === "string").slice(0, 3),
    });
    setTagInput(typeof draft.tagInput === "string" ? draft.tagInput : "");
    // Remount once so MDXEditor receives the restored Markdown as its initial
    // value. Continuously calling setMarkdown on each keystroke would move the
    // cursor and break normal editing.
    setEditorRevision((revision) => revision + 1);
  };

  const handleTagAdd = useCallback(
    (rawTag: string) => {
      const tag = rawTag.normalize("NFKC").trim();
      const currentTags = form.getValues("tags");

      if (!tag) {
        form.setError("tags", {
          type: "manual",
          message: "Tag cannot be empty.",
        });
        return false;
      }
      if (tag.length > 30) {
        form.setError("tags", {
          type: "manual",
          message: "Tag cannot exceed 30 characters.",
        });
        return false;
      }
      if (currentTags.length >= 3) {
        form.setError("tags", {
          type: "manual",
          message: "You can add up to 3 tags.",
        });
        return false;
      }
      if (
        currentTags.some(
          (currentTag) => currentTag.toLowerCase() === tag.toLowerCase(),
        )
      ) {
        form.setError("tags", {
          type: "manual",
          message: "Tag already added.",
        });
        return false;
      }

      form.setValue("tags", [...currentTags, tag], {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.clearErrors("tags");
      return true;
    },
    [form],
  );

  const currentWorkbenchDraft = useCallback(
    (): QuestionWorkbenchDraft => ({
      title: form.getValues("title"),
      content: form.getValues("content"),
      tags: form.getValues("tags"),
      questionId: isEdit ? question?._id : undefined,
    }),
    [form, isEdit, question?._id],
  );

  const handleDraftMutation = useCallback(
    (mutation: DraftEditMutation): DraftMutationResult => {
      const previousDraft = currentWorkbenchDraft();
      if (
        !isSameWorkbenchDraft(previousDraft, mutation.expectedDraft) ||
        previousDraft[mutation.field] !== mutation.expectedValue
      ) {
        return {
          ok: false,
          reason:
            "The draft changed before this suggestion was applied. Your newer work was kept.",
        };
      }

      if (
        mutation.field === "content" &&
        mutation.nextValue !== mutation.expectedValue &&
        mutation.nextValue.trim() === mutation.expectedValue.trim()
      ) {
        return {
          ok: false,
          reason:
            "This change only adjusts whitespace at the start or end of the question, which the editor cannot apply safely.",
        };
      }

      const nextDraft = {
        ...previousDraft,
        [mutation.field]: mutation.nextValue,
      };
      const parsed = QuestionWorkbenchDraftSchema.safeParse(nextDraft);
      if (!parsed.success) {
        return {
          ok: false,
          reason:
            parsed.error.issues[0]?.message ??
            "This suggestion would make the draft invalid.",
        };
      }

      form.setValue(mutation.field, mutation.nextValue, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      if (mutation.field === "content") {
        // React Hook Form owns the persisted value; MDXEditor also keeps an
        // imperative document model, so both must receive the same snapshot.
        editorRef.current?.setMarkdown(mutation.nextValue);
      }

      return { ok: true, previousDraft, draft: parsed.data };
    },
    [currentWorkbenchDraft, form],
  );

  const handleSuggestedTagAdd = useCallback(
    (
      tag: string,
      expectedDraft: QuestionWorkbenchDraft,
    ): DraftMutationResult => {
      const previousDraft = currentWorkbenchDraft();
      if (!isSameWorkbenchDraft(previousDraft, expectedDraft)) {
        return {
          ok: false,
          reason:
            "The draft changed before this tag was added. Your newer work was kept.",
        };
      }

      if (!handleTagAdd(tag)) {
        return {
          ok: false,
          reason: "This tag could not be added to the current draft.",
        };
      }

      const updatedDraft = currentWorkbenchDraft();
      const parsed = QuestionWorkbenchDraftSchema.safeParse(updatedDraft);
      if (!parsed.success) {
        return {
          ok: false,
          reason:
            parsed.error.issues[0]?.message ??
            "The updated draft is not valid yet.",
        };
      }

      return { ok: true, previousDraft, draft: parsed.data };
    },
    [currentWorkbenchDraft, handleTagAdd],
  );

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 在表单中按下 enter 添加到 tags 中，而不是提交表单
    if (e.key === "Enter") {
      // Input 的默认行为是在按下 Enter 键时提交表单。通过调用 e.preventDefault()，我们可以阻止这个默认行为，从而允许用户在输入标签时按 Enter 键来添加标签，而不是提交整个表单。
      e.preventDefault();
      if (handleTagAdd(e.currentTarget.value)) {
        // 在用户按下 Enter 键并成功添加标签后，我们需要清空输入框，以便用户可以继续输入下一个标签。
        setTagInput("");
      }
    }
  };

  const handleTagRemove = (
    tag: string,
    field: ControllerRenderProps<
      { title: string; content: string; tags: string[] },
      "tags"
    >,
  ) => {
    // 当用户点击标签上的移除按钮时，我们需要从 tags 数组中删除对应的标签
    const newTags = field.value.filter((t) => t !== tag);
    // 更新表单状态中的 tags 字段，确保 UI 能够正确反映标签的删除
    form.setValue("tags", newTags, {
      shouldDirty: true,
      shouldValidate: true,
    });
    // 如果用户删除了所有标签，我们需要设置一个错误提示，告诉用户至少需要添加一个标签
    if (newTags.length === 0) {
      form.setError("tags", {
        type: "manual",
        message: "At least one tag is required",
      });
    }
  };

  const handleCreateQuestion = async (
    data: z.infer<typeof AskQuestionSchema>,
  ) => {
    const requestOwner = session.data?.user?.id;
    // startTransition() 的作用是将 createQuestion 这个操作标记为一个低优先级的更新。这意味着在这个操作执行期间，React 会继续响应用户的其他交互，而不会因为这个操作而导致界面卡顿或无响应。
    startTransition(async () => {
      // 编辑问题的处理逻辑，跟创建问题分开
      if (isEdit && question) {
        const result = await editQuestion({
          questionId: question?._id,
          ...data,
        });
        if (draftOwnerRef.current !== requestOwner) return;

        if (result.success && result.data) {
          await clearDraft();
          if (draftOwnerRef.current !== requestOwner) return;
          toast.success("Success", {
            description: "Your question has been updated successfully.",
            position: "top-center",
          });
          router.push(ROUTES.QUESTION(result.data._id.toString()));
        } else {
          toast.error(`Error ${result.status ?? ""}`.trim(), {
            description:
              result.errors?.message ||
              "An error occurred while updating the question.",
            position: "top-center",
          });
        }
        // 如果是编辑问题，我们在处理完编辑逻辑后就直接返回，不执行后面的逻辑了
        return;
      }

      // 使用 server action 创建问题
      const result = await createQuestion(data);
      if (draftOwnerRef.current !== requestOwner) return;
      // 根据 server action 的结果显示成功或错误的 toast 提示，并在成功时重定向到新创建的问题页面
      if (result.success && result.data) {
        await clearDraft();
        if (draftOwnerRef.current !== requestOwner) return;
        toast.success("Success", {
          description: "Your question has been created successfully.",
          position: "top-center",
        });
        router.push(ROUTES.QUESTION(result.data._id.toString()));
      } else {
        toast.error(`Error ${result.status ?? ""}`.trim(), {
          description:
            result.errors?.message ||
            "An error occurred while creating the question.",
          position: "top-center",
        });
      }
    });
  };

  return (
    <form
      className="flex w-full flex-col gap-10"
      onSubmit={form.handleSubmit(handleCreateQuestion)}
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
          name="title"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel
                htmlFor="question-title"
                className="paragraph-semibold text-dark400_light800"
              >
                Question Title <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  {...field}
                  id="question-title"
                  className="paragraph-regular background-light700_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                />
                <FieldDescription className="body-regular mt-2.5 text-light-500">
                  Be specific and imagine you&apos;re asking a question to
                  another person.
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="content"
          render={({ field, fieldState }) => (
            <Field aria-labelledby="question-content-label">
              <FieldLabel
                id="question-content-label"
                className="paragraph-semibold text-dark400_light800"
              >
                Detailed explanation of your problem{" "}
                <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent>
                <Editor
                  key={editorRevision}
                  value={field.value}
                  editorRef={editorRef}
                  fieldChange={field.onChange}
                />
                <FieldDescription className="body-regular mt-2.5 text-light-500">
                  Introduce the problem and expand on what you&apos;ve put in
                  the title.
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <AIQuestionWorkbench
          key={`${session.data?.user?.id ?? session.status}:${question?._id ?? "new"}`}
          title={draftData.title}
          content={draftData.content}
          tags={draftData.tags}
          questionId={isEdit ? question?._id : undefined}
          onAddTag={handleSuggestedTagAdd}
          onMutateDraft={handleDraftMutation}
        />

        <Controller
          control={form.control}
          name="tags"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel
                htmlFor="question-tags"
                className="paragraph-semibold text-dark400_light800"
              >
                Tags <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent className="gap-3">
                <div>
                  <Input
                    id="question-tags"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    className="paragraph-regular background-light700_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                    placeholder="Add tags..."
                    onKeyDown={handleInputKeyDown}
                  />
                  {field.value.length > 0 && (
                    <div className="flex-start mt-2.5 flex-wrap gap-2.5">
                      {field.value.map((tag: string) => (
                        <TagCard
                          key={tag}
                          _id={tag}
                          name={tag}
                          compact
                          remove
                          isButton
                          handleRemove={() => handleTagRemove(tag, field)}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <FieldDescription className="body-regular mt-2.5 text-light-500">
                  Add up to 3 tags to describe what your question is about. You
                  need to press enter to add a tag.
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />
      </FieldGroup>

      <div className="mt-16 flex justify-end">
        <Button
          type="submit"
          disabled={isPending}
          className="primary-gradient w-fit text-light-900!"
        >
          {isPending ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>{isEdit ? "Update Question" : "Ask A Question"}</>
          )}
        </Button>
      </div>
    </form>
  );
};

export default QuestionForm;
