"use client";

import { Loader2Icon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";

import type {
  GlobalSearchItem,
  GlobalSearchType,
} from "@/lib/dal/global-search";
import { useI18n } from "@/lib/i18n/client";

interface Props {
  listboxId: string;
  query: string;
  type: GlobalSearchType | null;
  items: GlobalSearchItem[];
  isLoading: boolean;
  error: string | null;
  activeIndex: number;
  onTypeChange: (type: GlobalSearchType | null) => void;
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: GlobalSearchItem) => void;
}

const SEARCH_TYPES: Array<{
  label: string;
  value: GlobalSearchType | null;
}> = [
  { label: "All", value: null },
  { label: "Question", value: "question" },
  { label: "Answer", value: "answer" },
  { label: "User", value: "user" },
  { label: "Tag", value: "tag" },
];

const GlobalResult = ({
  listboxId,
  query,
  type,
  items,
  isLoading,
  error,
  activeIndex,
  onTypeChange,
  onActiveIndexChange,
  onSelect,
}: Props) => {
  const { t } = useI18n();
  const listboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedOption = listboxRef.current?.querySelector(
      '[aria-selected="true"]',
    );
    selectedOption?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const status = (() => {
    if (query.length < 2) return t("Type at least 2 characters to search.");
    if (error) return t(error);
    if (!isLoading && items.length === 0) return t("Oops, no results found");
    return null;
  })();

  return (
    <div className="absolute top-full z-10 mt-3 w-full rounded-xl bg-light-800 py-5 shadow-sm dark:bg-dark-400">
      <div className="flex items-center gap-3 overflow-x-auto px-5 pb-1">
        <p className="text-dark400_light900 body-medium shrink-0">{t("Type")}:</p>
        <div className="flex gap-2" aria-label={t("Search result type")}>
          {SEARCH_TYPES.map((filter) => {
            const selected = type === filter.value;

            return (
              <button
                type="button"
                key={filter.label}
                aria-pressed={selected}
                className={`light-border-2 small-medium shrink-0 rounded-2xl px-4 py-2 capitalize ${
                  selected
                    ? "bg-primary-500 text-light-900"
                    : "bg-light-700 text-dark-400 hover:text-primary-500 dark:bg-dark-500 dark:text-light-800 dark:hover:text-primary-500"
                }`}
                onClick={() => onTypeChange(filter.value)}
              >
                {t(filter.label)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="my-5 h-px bg-light-700/50 dark:bg-dark-500/50" />

      <div className="space-y-5">
        <p className="text-dark400_light900 paragraph-semibold px-5">
          {t("Top Match")}
        </p>

        {isLoading ? (
          <div className="flex-center flex-col px-5" role="status">
            <Loader2Icon
              className="my-2 size-10 animate-spin text-primary-500"
              aria-hidden="true"
            />
            <p className="text-dark200_light800 body-regular">
              {t("Browsing the whole database...")}
            </p>
          </div>
        ) : status ? (
          <p
            className="text-dark200_light800 body-regular px-5 py-2.5 text-center"
            role={error ? "alert" : "status"}
          >
            {status}
          </p>
        ) : (
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label={t("Global search results")}
            className="flex max-h-[390px] flex-col gap-2 overflow-y-auto"
          >
            {items.map((item, index) => {
              const active = index === activeIndex;

              return (
                <button
                  type="button"
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={active}
                  key={`${item.type}-${item.id}`}
                  className={`flex w-full cursor-pointer items-start gap-3 px-5 py-2.5 text-left ${
                    active
                      ? "bg-light-700/70 dark:bg-dark-500/70"
                      : "hover:bg-light-700/50 dark:hover:bg-dark-500/50"
                  }`}
                  onMouseMove={() => onActiveIndexChange(index)}
                  onClick={() => onSelect(item)}
                >
                  <Image
                    src="/icons/tag.svg"
                    alt=""
                    width={18}
                    height={18}
                    aria-hidden="true"
                    className="invert-colors mt-1 object-contain"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="body-medium text-dark200_light800 line-clamp-2 block">
                      {item.title}
                    </span>
                    <span className="text-light400_light500 small-medium mt-1 block font-bold">
                      <span className="capitalize">{t(item.type.charAt(0).toUpperCase() + item.type.slice(1))}</span>
                      {item.subtitle ? ` · ${item.subtitle}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-light400_light500 small-regular mt-4 px-5">
        {t("Use ↑ ↓ to navigate, Enter to open, Esc to close")}
      </p>
    </div>
  );
};

export default GlobalResult;
