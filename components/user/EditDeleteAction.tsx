"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAnswer } from "@/lib/actions/answer.action";
import { deleteQuestion } from "@/lib/actions/question.action";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client";

interface Props {
  type: "Question" | "Answer";
  itemId: string;
}

const EditDeleteAction = ({ type, itemId }: Props) => {
  const { t } = useI18n();
  const router = useRouter();

  const handleEdit = async () => {
    if (type === "Question") {
      router.push(`/questions/${itemId}/edit`);
    }
  };

  // 删除问题或答案的函数
  const handleDelete = async () => {
    try {
      const result =
        type === "Question"
          ? await deleteQuestion({ questionId: itemId })
          : await deleteAnswer({ answerId: itemId });

      if (!result.success) {
        throw new Error(result.errors?.message || `Failed to delete ${type}`);
      }

      toast.success(t(`${type} deleted successfully!`), {
        description:
          type === "Question"
            ? t("Your question has been removed.")
            : t("Your answer has been removed."),
        position: "top-center",
      });

      // router.refresh() 是 App Router 里客户端组件用来刷新当前路由数据 的方法。
      // 它的作用不是浏览器那种完整刷新页面，而是：
      // 重新向服务端请求当前路由的 React Server Component 数据，让 Server Component 重新渲染，然后把新结果合并回当前页面。
      router.refresh();
    } catch (error) {
      toast.error(t(`Failed to delete ${type.toLowerCase()}`), {
        description:
          error instanceof Error ? t(error.message) : t("An unknown error occurred"),
        position: "top-center",
      });
    }
  };
  return (
    <div
      className={`flex items-center justify-end gap-3 max-sm:w-full ${type === "Answer" && "gap-0 justify-center"}`}
    >
      {type === "Question" && (
        <Image
          src="/icons/edit.svg"
          alt={t("Edit")}
          width={14}
          height={14}
          className="cursor-pointer object-contain"
          onClick={handleEdit}
        />
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild className="cursor-pointer">
          <Image src="/icons/trash.svg" alt={t("Delete")} width={14} height={14} />
        </AlertDialogTrigger>
        <AlertDialogContent className="background-light800_dark300">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Are you absolutely sure?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                type === "Question"
                  ? "This action cannot be undone. Your question will be permanently deleted from our servers."
                  : "This action cannot be undone. Your answer will be permanently deleted from our servers.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn">{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="border-primary-100! bg-primary-500! text-light-800!"
              onClick={handleDelete}
            >
              {t("Continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EditDeleteAction;
