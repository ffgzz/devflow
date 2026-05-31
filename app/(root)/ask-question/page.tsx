import { auth } from "@/auth";
import QuestionForm from "@/components/forms/QuestionForm";
import { redirect } from "next/navigation";

const AskQuestion = async () => {
  const session = await auth();
  if (!session) {
    // 如果用户没有登录，重定向到登录页面
    // 这个 redirect 是服务端重定向，和客户端的 router.push 不同，
    // 服务端重定向会直接返回一个重定向响应给浏览器，告诉浏览器去新的 URL
    return redirect("/sign-in");
  }

  return (
    <>
      <h1 className="h1-bold text-dark100_light900">Ask a Question</h1>
      <div className="mt-9">
        <QuestionForm />
      </div>
    </>
  );
};

export default AskQuestion;
