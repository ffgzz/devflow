import QuestionCard from "@/components/cards/QuestionCard";
import DataRenderer from "@/components/DataRenderer";
import CommonFilter from "@/components/filters/CommonFilter";
import Pagination from "@/components/Pagination";
import LocalSearch from "@/components/search/LocalSearch";
import { CollectionFilters } from "@/constants/filters";
import ROUTES from "@/constants/routes";
import { EMPTY_QUESTION } from "@/constants/states";
import { getSavedQuestions } from "@/lib/actions/collection.action";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Saved Questions",
  description: "Review the DevFlow questions saved to your private collection.",
  robots: { index: false, follow: false },
};

interface SearchParams {
  searchParams: Promise<{ [key: string]: string }>;
}

export default async function Collection({ searchParams }: SearchParams) {
  const { t } = await getI18n();
  const { page, pageSize, query, filter } = await searchParams;

  const { success, data, errors } = await getSavedQuestions({
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 10,
    query,
    filter,
  });
  const { collection, isNext } = data || {};

  // 根据 query 和 filter 来过滤问题列表
  // const filteredQuestions = questions?.filter((question) =>
  //   question.title.toLowerCase().includes(query?.toLowerCase()) && filter
  //     ? question.tags[0].name?.toLowerCase() === filter?.toLowerCase()
  //     : true,
  // );

  return (
    <>
      <h1 className="h1-bold text-dark100_light900">{t("Saved Questions")}</h1>

      <div className="mt-11 flex justify-between sm:items-center gap-5 max-sm:flex-col ">
        <LocalSearch
          route={ROUTES.COLLECTION}
          imgSrc="/icons/search.svg"
          placeholder={t("Search questions...")}
          otherClasses="flex-1"
        />
        <CommonFilter
          filters={CollectionFilters}
          otherClasses="min-h-[56px] sm:min-w-[170px]"
        />
      </div>

      {/* 可复用的数据渲染器，既可以渲染数据，也可以展示空状态和错误状态 */}
      <DataRenderer
        success={success}
        error={errors}
        data={collection}
        empty={EMPTY_QUESTION}
        render={(collection) => (
          <div className="mt-10 flex w-full flex-col gap-6">
            {collection.map((item) => (
              <QuestionCard key={item._id} question={item.question} />
            ))}
          </div>
        )}
      />

      <Pagination page={page} isNext={isNext || false} />
    </>
  );
}
