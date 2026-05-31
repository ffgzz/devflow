import QuestionCard from "@/components/cards/QuestionCard";
import DataRenderer from "@/components/DataRenderer";
import LocalSearch from "@/components/search/LocalSearch";
import ROUTES from "@/constants/routes";
import { EMPTY_QUESTION } from "@/constants/states";
import { getTagQuestions } from "@/lib/actions/tag.action";

const page = async ({ params, searchParams }: RouteParams) => {
  const { id } = await params;
  const { page, pageSize, query } = await searchParams;

  const { success, data, errors } = await getTagQuestions({
    tagId: id,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 10,
    query,
  });

  const { tag, questions } = data || {};

  return (
    <>
      <section
        className="w-full flex flex-col-reverse sm:flex-row sm:items-center
        justify-between gap-4"
      >
        <h1 className="h1-bold text-dark100_light900">{tag?.name}</h1>
      </section>
      <section className="mt-11">
        <LocalSearch
          route={ROUTES.TAG(id)}
          imgSrc="/icons/search.svg"
          placeholder="Search questions..."
          otherClasser="flex-1"
        />
      </section>

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
    </>
  );
};

export default page;
