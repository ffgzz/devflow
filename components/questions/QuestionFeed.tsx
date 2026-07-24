"use client";

import QuestionCard from "@/components/cards/QuestionCard";
import { Button } from "@/components/ui/button";
import type {
  QuestionFeedFilter,
  QuestionFeedItem,
  QuestionFeedPage,
} from "@/lib/recommendation/types";
import { CircleXIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client";

interface Props {
  initialPage: QuestionFeedPage;
  filter: QuestionFeedFilter;
  query: string;
  canPersonalize: boolean;
}

interface FeedAPIResponse {
  success: boolean;
  data?: QuestionFeedPage;
  errors?: { message?: string };
}

async function persistFeedback(questionId: string, hidden: boolean) {
  const response = await fetch("/api/recommendations/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, hidden }),
  });
  const payload = (await response.json()) as FeedAPIResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.message ?? "Could not update your feed.");
  }
}

const deduplicateItems = (items: QuestionFeedItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.question._id)) return false;
    seen.add(item.question._id);
    return true;
  });
};

const QuestionFeed = ({
  initialPage,
  filter,
  query,
  canPersonalize,
}: Props) => {
  const { t } = useI18n();
  const [items, setItems] = useState(initialPage.items);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestLockRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    abortRef.current?.abort();
    requestLockRef.current = false;
    setItems(initialPage.items);
    setCursor(initialPage.nextCursor);
    setIsLoading(false);
    setError(null);
  }, [filter, initialPage, query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadMore = useCallback(async () => {
    if (!cursor || requestLockRef.current) return;

    requestLockRef.current = true;
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const params = new URLSearchParams({
      filter,
      limit: "10",
      cursor,
    });
    if (query) params.set("query", query);

    try {
      const response = await fetch(`/api/questions/feed?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as FeedAPIResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(
          payload.errors?.message ?? "Could not load more questions.",
        );
      }

      setItems((current) =>
        deduplicateItems([...current, ...payload.data!.items]),
      );
      setCursor(payload.data.nextCursor);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(
          requestError instanceof Error
            ? t(requestError.message)
            : t("Could not load more questions."),
        );
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
      requestLockRef.current = false;
    }
  }, [cursor, filter, query, t]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const restoreHiddenItem = async (
    item: QuestionFeedItem,
    originalIndex: number,
  ) => {
    try {
      await persistFeedback(item.question._id, false);
      setItems((current) => {
        if (
          current.some(({ question }) => question._id === item.question._id)
        ) {
          return current;
        }
        const next = [...current];
        next.splice(Math.min(originalIndex, next.length), 0, item);
        return next;
      });
      toast.success(t("The question is back in your recommendations."));
    } catch (undoError) {
      toast.error(
        undoError instanceof Error
          ? t(undoError.message)
          : t("Could not restore the question."),
      );
    }
  };

  const hideItem = async (item: QuestionFeedItem, originalIndex: number) => {
    setItems((current) =>
      current.filter(({ question }) => question._id !== item.question._id),
    );

    try {
      await persistFeedback(item.question._id, true);
      toast(t("Question hidden from your recommendations."), {
        action: {
          label: t("Undo"),
          onClick: () => void restoreHiddenItem(item, originalIndex),
        },
      });
    } catch (feedbackError) {
      setItems((current) => {
        const next = [...current];
        next.splice(Math.min(originalIndex, next.length), 0, item);
        return deduplicateItems(next);
      });
      toast.error(
        feedbackError instanceof Error
          ? t(feedbackError.message)
          : t("Could not update your feed."),
      );
    }
  };

  const isRecommendationFeed = filter === "recommended";
  const modeLabel =
    initialPage.mode === "personalized"
      ? t("Personalized from your recent activity")
      : initialPage.mode === "cold-start"
        ? t("New here? We are showing fresh community trends")
        : null;

  if (items.length === 0 && !cursor) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-light-700 px-6 py-12 text-center dark:border-dark-400">
        <p className="h3-semibold text-dark200_light900">
          {t("No matching questions yet")}
        </p>
        <p className="body-regular text-dark400_light700 mt-2">
          {t("Try another search, change the filter, or start the discussion.")}
        </p>
        <Button asChild className="mt-5 bg-primary-500 text-light-900">
          <Link href="/ask-question">{t("Ask a question")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <section className="mt-10" aria-label={t("Question feed")}>
      {modeLabel && (
        <div className="text-dark400_light700 small-medium mb-4 flex items-center gap-2">
          <SparklesIcon
            className="size-4 text-primary-500"
            aria-hidden="true"
          />
          <span>{modeLabel}</span>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {items.map((item, index) => (
          <article key={item.question._id} className="relative">
            <div className="background-light800_darkgradient flex min-h-10 items-center justify-between gap-3 rounded-t-[10px] px-5 py-2">
              <p className="small-medium text-dark400_light700 flex items-center gap-2">
                <SparklesIcon
                  className="size-3.5 text-primary-500"
                  aria-hidden="true"
                />
                {t(item.recommendation.label)}
              </p>

              {isRecommendationFeed && canPersonalize && (
                <button
                  type="button"
                  className="text-dark400_light700 hover:text-primary-500 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 focus-visible:outline-2 focus-visible:outline-primary-500"
                  aria-label={`${t("Not interested in")} ${item.question.title}`}
                  onClick={() => void hideItem(item, index)}
                >
                  <CircleXIcon className="size-4" aria-hidden="true" />
                  <span className="small-medium max-sm:hidden">
                    {t("Not interested")}
                  </span>
                </button>
              )}
            </div>
            <div className="[&>div]:rounded-t-none">
              <QuestionCard question={item.question} />
            </div>
          </article>
        ))}
      </div>

      <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      <div className="mt-6 flex flex-col items-center gap-3" aria-live="polite">
        {error && (
          <p className="small-regular text-red-500" role="alert">
            {t(error)}
          </p>
        )}
        {cursor ? (
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => void loadMore()}
            className="min-w-32"
          >
            {isLoading ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden="true" />
                {t("Loading…")}
              </>
            ) : error ? (
              t("Try again")
            ) : (
              t("Load more")
            )}
          </Button>
        ) : (
          <p className="small-regular text-dark400_light700">
            {t("You have reached the end of this feed.")}
          </p>
        )}
      </div>
    </section>
  );
};

export default QuestionFeed;
