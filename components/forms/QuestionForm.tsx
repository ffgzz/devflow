"use client";

import { AskQuestionSchema } from "@/lib/validations";
// zodResolver 是连接 Zod校验规则 和 React Hook Form 的桥梁
import ROUTES from "@/constants/routes";
import { createQuestion, editQuestion } from "@/lib/actions/question.action";
import { zodResolver } from "@hookform/resolvers/zod";
import { MDXEditorMethods } from "@mdxeditor/editor";
import { Loader2Icon } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useRef, useTransition } from "react";
import { Controller, ControllerRenderProps, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import TagCard from "../cards/TagCard";
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

const QuestionForm = ({ question, isEdit = false }: Params) => {
  const router = useRouter();
  const editorRef = useRef<MDXEditorMethods>(null);
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

  const handleInputKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    field: ControllerRenderProps<
      { title: string; content: string; tags: string[] },
      "tags"
    >,
  ) => {
    // 在表单中按下 enter 添加到 tags 中，而不是提交表单
    if (e.key === "Enter") {
      // Input 的默认行为是在按下 Enter 键时提交表单。通过调用 e.preventDefault()，我们可以阻止这个默认行为，从而允许用户在输入标签时按 Enter 键来添加标签，而不是提交整个表单。
      e.preventDefault();
      const tagInput = e.currentTarget.value.trim();

      if (tagInput && tagInput.length < 15 && !field.value.includes(tagInput)) {
        form.setValue("tags", [...field.value, tagInput]);
        // 在用户按下 Enter 键并成功添加标签后，我们需要清空输入框，以便用户可以继续输入下一个标签。
        e.currentTarget.value = "";
        // 清除标签相关的错误信息（如果有的话），确保用户在添加标签后不会看到错误提示。
        form.clearErrors("tags");
      } else if (tagInput.length >= 15) {
        form.setError("tags", {
          type: "manual",
          message: "Tag must be less than 15 characters",
        });
      } else if (field.value.includes(tagInput)) {
        form.setError("tags", {
          type: "manual",
          message: "Tag already added",
        });
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
    form.setValue("tags", newTags);
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
    // startTransition() 的作用是将 createQuestion 这个操作标记为一个低优先级的更新。这意味着在这个操作执行期间，React 会继续响应用户的其他交互，而不会因为这个操作而导致界面卡顿或无响应。
    startTransition(async () => {
      // 编辑问题的处理逻辑，跟创建问题分开
      if (isEdit && question) {
        const result = await editQuestion({
          questionId: question?._id,
          ...data,
        });

        if (result.success) {
          toast.success("Success", {
            description: "Your question has been updated successfully.",
            position: "top-center",
          });
          if (result.data)
            router.push(ROUTES.QUESTION(result.data._id.toString()));
          else
            toast.error(`Error ${result.status}`, {
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
      // 根据 server action 的结果显示成功或错误的 toast 提示，并在成功时重定向到新创建的问题页面
      if (result.success) {
        toast.success("Success", {
          description: "Your question has been created successfully.",
          position: "top-center",
        });
        if (result.data)
          router.push(ROUTES.QUESTION(result.data._id.toString()));
        else
          toast.error(`Error ${result.status}`, {
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
      <FieldGroup>
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel className="paragraph-semibold text-dark400_light800">
                Question Title <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  {...field}
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
            <Field>
              <FieldLabel className="paragraph-semibold text-dark400_light800">
                Detailed explanation of your problem{" "}
                <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent>
                <Editor
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

        <Controller
          control={form.control}
          name="tags"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel className="paragraph-semibold text-dark400_light800">
                Tags <span className="text-primary-500">*</span>
              </FieldLabel>
              <FieldContent className="gap-3">
                <div>
                  <Input
                    className="paragraph-regular background-light700_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                    placeholder="Add tags..."
                    onKeyDown={(e) => {
                      handleInputKeyDown(e, field);
                    }}
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
