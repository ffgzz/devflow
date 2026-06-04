import AllAnswers from "@/components/answers/AllAnswers";
import TagCard from "@/components/cards/TagCard";
import Preview from "@/components/editor/Preview";
import AnswerForm from "@/components/forms/AnswerForm";
import Metric from "@/components/Metric";
import SaveQuestion from "@/components/questions/SaveQuestion";
import UserAvatar from "@/components/UserAvatar";
import Votes from "@/components/votes/Votes";
import ROUTES from "@/constants/routes";
import { getAnswers } from "@/lib/actions/answer.action";
import { hasSavedQuestion } from "@/lib/actions/collection.action";
import { getQuestion, incrementViews } from "@/lib/actions/question.action";
import { hasVoted } from "@/lib/actions/vote.action";
import { formatNumber, getTimeStamp } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";

const QuestionDetails = async ({ params, searchParams }: RouteParams) => {
  const { id } = await params;
  const { page, pageSize, filter } = await searchParams;
  // 获取问题的详细信息，包括标题、内容、作者、标签、浏览量等
  const { success, data: question } = await getQuestion({ questionId: id });

  // after 是 Next.js 提供的一个服务端函数
  // 它的作用是：把一段工作安排到“响应发送完成之后”再执行。
  // 这里我们用它来确保：在用户请求这个问题详情页的时候，我们先把页面内容正常加载并发送给用户，
  // 等这一切都完成了之后，我们再去执行 incrementViews 这个函数来增加问题的浏览量。
  after(async () => {
    await incrementViews({ questionId: id });
  });

  // 如果没有成功获取到问题数据，或者问题不存在，我们就重定向到 404 页面
  if (!success || !question) {
    return redirect("/404");
  }

  // 获取问题的答案列表，这里我们默认获取第一页，每页10条，按照最新的顺序排序
  const {
    success: areAnswersLoaded,
    data: answersResult,
    errors: AnswersErrors,
  } = await getAnswers({
    questionId: id,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 10,
    filter,
  });
  // 获取用户是否已经对这个问题投过票，这样我们就可以在界面上正确显示投票按钮的状态（已投票或未投票）
  const hasVotedPromise = hasVoted({
    targetId: id,
    targetType: "question",
  });

  // 获取用户是否已经收藏过这个问题，这样我们就可以在界面上正确显示收藏按钮的状态（已收藏或未收藏）
  const hasSavedQuestionPromise = hasSavedQuestion({
    questionId: id,
  });

  const { answers, views, title, tags, author, content, createdAt } = question;

  return (
    <>
      <div className="flex-start w-full flex-col">
        <div className="flex w-full flex-col-reverse justify-between">
          <div className="flex items-center justify-start gap-1">
            <UserAvatar
              id="author-id"
              name="Author Name"
              imageUrl={author.image}
              className="size-[22px]"
              falllbackClassName="text-[10px]"
            />
            <Link href={ROUTES.PROFILE("author-id")}>
              <p className="paragraph-semibold text-dark300_light700">
                {author.name}
              </p>
            </Link>
          </div>

          {/* 投票的地方 */}
          <div className="flex justify-end">
            <Suspense fallback={<div>Loading votes...</div>}>
              <Votes
                upvotes={question.upvotes}
                downvotes={question.downvotes}
                hasVotedPromise={hasVotedPromise}
                targetId={id}
                targetType="question"
              />
            </Suspense>

            <Suspense fallback={<div>Loading save button...</div>}>
              {/* 收藏问题的按钮 */}
              <SaveQuestion
                questionId={id}
                hasSavedQuestionPromise={hasSavedQuestionPromise}
              />
            </Suspense>
          </div>
        </div>

        <h2 className="h2-semibold text-dark200_light900 mt-3.5 w-full">
          {title}
        </h2>
      </div>

      {/* 指标部分 */}
      <div className="mb-8 mt-5 flex flex-wrap gap-4">
        <Metric
          imgUrl="/icons/clock.svg"
          alt="Clock icon"
          value={` asked ${getTimeStamp(new Date(createdAt))}`}
          title=""
          textStyles="small-regular text-dark400_light700"
        />

        <Metric
          imgUrl="/icons/message.svg"
          alt="Message icon"
          value={formatNumber(answers)}
          title=""
          textStyles="small-regular text-dark400_light700"
        />

        <Metric
          imgUrl="/icons/eye.svg"
          alt="eye icon"
          value={formatNumber(views)}
          title=""
          textStyles="small-regular text-dark400_light700"
        />
      </div>

      {/* 问题内容预览 */}
      <Preview content={content} />

      <div className="mt-8 flex flex-wrap gap-2">
        {/* 标签部分 */}
        {tags.map((tag: Tag) => (
          <TagCard key={tag._id} _id={tag._id} name={tag.name} compact />
        ))}
      </div>

      {/* 回答部分 */}
      <section className="my-5">
        <AllAnswers
          page={Number(page) || 1}
          isNext={answersResult?.isNext || false}
          data={answersResult?.answers}
          success={areAnswersLoaded}
          errors={AnswersErrors}
          totalAnswers={answersResult?.totalAnswers || 0}
        />
      </section>

      {/* 创建回答的表单 */}
      <section className="my-5">
        <AnswerForm
          questionId={id}
          questionTitle={question.title}
          questionContent={question.content}
        />
      </section>
    </>
  );
};

export default QuestionDetails;
