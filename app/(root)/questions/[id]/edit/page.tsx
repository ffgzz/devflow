import { auth } from "@/auth";
import QuestionForm from "@/components/forms/QuestionForm";
import ROUTES from "@/constants/routes";
import { getQuestion } from "@/lib/actions/question.action";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Edit Question",
  description: "Edit a DevFlow programming question.",
  robots: { index: false, follow: false },
};

const EditQuestion = async ({ params }: RouteParams) => {
  const { id } = await params;
  // 导航到 404 页面
  if (!id) return notFound();

  const session = await auth();
  if (!session) {
    // 如果用户没有登录，重定向到登录页面
    // 这个 redirect 是服务端重定向，和客户端的 router.push 不同，
    // 服务端重定向会直接返回一个重定向响应给浏览器，告诉浏览器去新的 URL
    return redirect("/sign-in");
  }
  // 获取问题详情
  const { data: question, success } = await getQuestion({ questionId: id });
  if (!success) return notFound();
  // 只有问题的作者才能编辑问题，如果当前登录用户不是问题的作者，重定向到问题详情页面
  if (question?.author._id.toString() !== session?.user?.id) {
    return redirect(ROUTES.QUESTION(id));
  }

  return <QuestionForm question={question} isEdit />;
};

export default EditQuestion;
