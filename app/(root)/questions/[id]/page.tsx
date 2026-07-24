import AllAnswers from "@/components/answers/AllAnswers";
import { auth } from "@/auth";
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
import { getQuestion } from "@/lib/actions/question.action";
import { recordQuestionView } from "@/lib/dal/question-view";
import {
  absoluteUrl,
  serializeJsonLd,
  SITE_NAME,
  toPlainText,
} from "@/lib/seo";
import { hasVoted } from "@/lib/actions/vote.action";
import { formatNumber, getTimeStamp } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache, Suspense } from "react";
import { getI18n } from "@/lib/i18n/server";

const getQuestionForPage = cache((questionId: string) =>
  getQuestion({ questionId }),
);

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { id } = await params;

  try {
    const { success, data: question } = await getQuestionForPage(id);
    if (!success || !question) {
      return {
        title: "Question not found",
        robots: { index: false, follow: false },
      };
    }

    const pathname = ROUTES.QUESTION(id);
    const description =
      toPlainText(question.content, 180) ||
      `Read community answers to ${question.title}.`;

    return {
      title: question.title,
      description,
      keywords: question.tags.map((tag) => tag.name),
      alternates: { canonical: pathname },
      openGraph: {
        type: "article",
        locale: "en_US",
        url: pathname,
        siteName: SITE_NAME,
        title: question.title,
        description,
        publishedTime: new Date(question.createdAt).toISOString(),
        authors: [question.author.name],
        tags: question.tags.map((tag) => tag.name),
      },
      twitter: {
        card: "summary_large_image",
        title: question.title,
        description,
      },
    };
  } catch {
    return {
      title: "Programming Question",
      robots: { index: false, follow: false },
    };
  }
}

const QuestionDetails = async ({ params, searchParams }: RouteParams) => {
  const { locale, t } = await getI18n();
  const { id } = await params;
  const { page, pageSize, filter, answer } = await searchParams;
  const parsedPage = Number(page);
  const parsedPageSize = Number(pageSize);
  const currentPage =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const currentPageSize =
    Number.isSafeInteger(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, 100)
      : 10;
  const highlightedAnswerId = /^[0-9a-f]{24}$/iu.test(answer ?? "")
    ? answer
    : undefined;
  // 获取问题的详细信息，包括标题、内容、作者、标签、浏览量等
  const { success, data: question } = await getQuestionForPage(id);

  // 如果没有成功获取到问题数据，或者问题不存在，我们就重定向到 404 页面
  if (!success || !question) {
    notFound();
  }

  // Request-time auth must be read before `after()` in a Server Component.
  // The captured local id can then be used by the server-only telemetry helper.
  const session = await auth();
  after(async () => {
    await recordQuestionView(id, session?.user?.id);
  });

  // 获取问题的答案列表，这里我们默认获取第一页，每页10条，按照最新的顺序排序
  const {
    success: areAnswersLoaded,
    data: answersResult,
    errors: AnswersErrors,
  } = await getAnswers({
    questionId: id,
    page: currentPage,
    pageSize: currentPageSize,
    filter,
    highlightedAnswerId,
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

  const {
    answers,
    views,
    title,
    tags,
    author,
    content,
    createdAt,
    acceptedAnswer,
  } = question;
  const canManageAcceptance = session?.user?.id === author._id;
  const questionUrl = absoluteUrl(ROUTES.QUESTION(id));
  const answerEntities = (answersResult?.answers ?? []).map((item) => ({
    "@type": "Answer",
    text: toPlainText(item.content, 5_000),
    dateCreated: new Date(item.createdAt).toISOString(),
    upvoteCount: Math.max(0, item.upvotes),
    url: `${questionUrl}?answer=${item._id}#answer-${item._id}`,
    author: {
      "@type": "Person",
      name: item.author.name || "Anonymous",
      url: absoluteUrl(ROUTES.PROFILE(item.author._id)),
    },
  }));
  const acceptedAnswerIndex = acceptedAnswer
    ? (answersResult?.answers ?? []).findIndex(
        (item) => item._id === acceptedAnswer.toString(),
      )
    : -1;
  const acceptedAnswerEntity =
    acceptedAnswerIndex >= 0 ? answerEntities[acceptedAnswerIndex] : undefined;
  const suggestedAnswerEntities = answerEntities.filter(
    (_, index) => index !== acceptedAnswerIndex,
  );
  const questionJsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      "@id": `${questionUrl}#question`,
      name: title,
      text: toPlainText(content, 10_000),
      answerCount: answers,
      upvoteCount: Math.max(0, question.upvotes),
      dateCreated: new Date(createdAt).toISOString(),
      url: questionUrl,
      author: {
        "@type": "Person",
        name: author.name || "Anonymous",
        url: absoluteUrl(ROUTES.PROFILE(author._id)),
      },
      ...(acceptedAnswerEntity
        ? { acceptedAnswer: acceptedAnswerEntity }
        : {}),
      ...(suggestedAnswerEntities.length > 0
        ? { suggestedAnswer: suggestedAnswerEntities }
        : {}),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(questionJsonLd) }}
      />

      <article aria-labelledby="question-title">
        <div className="flex-start w-full flex-col">
          <div className="flex w-full flex-col-reverse justify-between">
            <div className="flex items-center justify-start gap-1">
              <UserAvatar
                id={author._id}
                name={author.name || t("Anonymous")}
                imageUrl={author.image}
                className="size-[22px]"
                falllbackClassName="text-[10px]"
              />
              <Link href={ROUTES.PROFILE(author._id)}>
                <p className="paragraph-semibold text-dark300_light700">
                  {author.name}
                </p>
              </Link>
            </div>

            {/* 投票的地方 */}
            <div className="flex justify-end">
              <Suspense fallback={<div>{t("Loading votes...")}</div>}>
                <Votes
                  upvotes={question.upvotes}
                  downvotes={question.downvotes}
                  hasVotedPromise={hasVotedPromise}
                  targetId={id}
                  targetType="question"
                  targetAuthorId={author._id}
                />
              </Suspense>

              <Suspense fallback={<div>{t("Loading save button...")}</div>}>
                {/* 收藏问题的按钮 */}
                <SaveQuestion
                  questionId={id}
                  hasSavedQuestionPromise={hasSavedQuestionPromise}
                />
              </Suspense>
            </div>
          </div>

          <h1
            id="question-title"
            className="h2-semibold text-dark200_light900 mt-3.5 w-full"
          >
            {title}
          </h1>
        </div>

        {/* 指标部分 */}
        <div className="mb-8 mt-5 flex flex-wrap gap-4">
          <Metric
            imgUrl="/icons/clock.svg"
            alt="Clock icon"
            value={` ${t("asked {time}", { time: getTimeStamp(new Date(createdAt), locale) })}`}
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
      </article>

      {/* 回答部分 */}
      <section className="my-5">
        <AllAnswers
          page={currentPage}
          isNext={answersResult?.isNext || false}
          data={answersResult?.answers}
          success={areAnswersLoaded}
          errors={AnswersErrors}
          totalAnswers={answersResult?.totalAnswers || 0}
          questionId={id}
          acceptedAnswerId={acceptedAnswer ?? null}
          canManageAcceptance={canManageAcceptance}
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
