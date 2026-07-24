import { auth } from "@/auth";
import CommonFilter from "@/components/filters/CommonFilter";
import HomeFilter from "@/components/filters/HomeFilter";
import QuestionFeed from "@/components/questions/QuestionFeed";
import LocalSearch from "@/components/search/LocalSearch";
import { Button } from "@/components/ui/button";
import { HomePageFilters } from "@/constants/filters";
import ROUTES from "@/constants/routes";
import { getQuestionFeed } from "@/lib/dal/question-feed";
import {
  QUESTION_FEED_FILTERS,
  type QuestionFeedFilter,
} from "@/lib/recommendation/types";
import { createPageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export const metadata = createPageMetadata({
  title: "Developer Questions & Answers",
  description:
    "Explore practical programming questions, community answers, and explainable recommendations across modern frontend development.",
  pathname: "/",
});

interface SearchParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: SearchParams) {
  const { t } = await getI18n();
  const params = await searchParams;
  const rawQuery = Array.isArray(params.query) ? params.query[0] : params.query;
  const rawFilter = Array.isArray(params.filter)
    ? params.filter[0]
    : params.filter;
  const filter: QuestionFeedFilter = QUESTION_FEED_FILTERS.includes(
    rawFilter as QuestionFeedFilter,
  )
    ? (rawFilter as QuestionFeedFilter)
    : "newest";
  const query = rawQuery?.trim().slice(0, 100) ?? "";
  const session = await auth();
  const initialPage = await getQuestionFeed({
    userId: session?.user?.id,
    filter,
    query,
    limit: 10,
  });

  return (
    <>
      <section className="flex w-full flex-col-reverse justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="h1-bold text-dark100_light900">
          {t(filter === "recommended" ? "For You" : "All Questions")}
        </h1>
        <Button
          asChild
          className="primary-gradient min-h-[46px] px-4 py-3 text-light-900!"
        >
          <Link href={ROUTES.ASK_QUESTION}>{t("Ask a Question")}</Link>
        </Button>
      </section>

      <section className="mt-11 flex justify-between gap-5 max-sm:flex-col sm:items-center">
        <LocalSearch
          route="/"
          imgSrc="/icons/search.svg"
          placeholder={t("Search questions...")}
          otherClasses="flex-1"
        />

        <CommonFilter
          filters={HomePageFilters}
          otherClasses="min-h-[56px] sm:min-w-[170px]"
          containerClasses="hidden max-md:flex"
          fallbackValue="newest"
        />
      </section>

      <HomeFilter />

      <QuestionFeed
        key={`${filter}:${query}`}
        initialPage={initialPage}
        filter={filter}
        query={query}
        canPersonalize={Boolean(session?.user?.id)}
      />
    </>
  );
}
