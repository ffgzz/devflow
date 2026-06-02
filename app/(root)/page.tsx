import QuestionCard from "@/components/cards/QuestionCard";
import DataRenderer from "@/components/DataRenderer";
import HomeFilter from "@/components/filters/HomeFilter";
import LocalSearch from "@/components/search/LocalSearch";
import { Button } from "@/components/ui/button";
import ROUTES from "@/constants/routes";
import { EMPTY_QUESTION } from "@/constants/states";
import { getQuestions } from "@/lib/actions/question.action";
import Link from "next/link";

interface SearchParams {
  searchParams: Promise<{ [key: string]: string }>;
}

export default async function Home({ searchParams }: SearchParams) {
  const { page, pageSize, query, filter } = await searchParams;

  const { success, data, errors } = await getQuestions({
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 10,
    query,
    filter,
  });
  const { questions } = data || {};

  // 根据 query 和 filter 来过滤问题列表
  // const filteredQuestions = questions?.filter((question) =>
  //   question.title.toLowerCase().includes(query?.toLowerCase()) && filter
  //     ? question.tags[0].name?.toLowerCase() === filter?.toLowerCase()
  //     : true,
  // );

  return (
    <>
      <section
        className="w-full flex flex-col-reverse sm:flex-row sm:items-center
        justify-between gap-4"
      >
        <h1 className="h1-bold text-dark100_light900">All Questions</h1>
        {/* asChild 是为了让 Link 拥有 Button 样式，同时保持最终 HTML 语义是 <a> */}
        <Button
          asChild
          className="primary-gradient min-h-[46px] px-4 py-3 text-light-900!"
        >
          <Link href={ROUTES.ASK_QUESTION}>Ask a Question</Link>
        </Button>
      </section>
      <section className="mt-11">
        <LocalSearch
          route="/"
          imgSrc="/icons/search.svg"
          placeholder="Search questions..."
          otherClasses="flex-1"
        />
      </section>

      {/* 用于筛选问题 */}
      <HomeFilter />

      {/* 可复用的数据渲染器，既可以渲染数据，也可以展示空状态和错误状态 */}
      <DataRenderer
        success={success}
        error={errors}
        data={questions}
        empty={EMPTY_QUESTION}
        render={(questions) => (
          <div className="mt-10 flex w-full flex-col gap-6">
            {questions.map((question) => (
              <QuestionCard key={question._id} question={question} />
            ))}
          </div>
        )}
      />

      {/* 获取成功才显示问题列表
      {success ? (
        <div className="mt-10 flex w-full flex-col gap-6">
          {questions && questions.length > 0 ? (
            questions.map((question) => (
              <QuestionCard key={question._id} question={question} />
            ))
          ) : (
            <div className="mt-10 flex items-center justify-center w-full">
              <p className="text-dark400_light700">No questions found.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-10 flex justify-center items-center w-full">
          <p className="text-dark400_light700">
            {errors?.message || "An error occurred while fetching questions."}
          </p> 
        </div>
      )} */}
    </>
  );
}
