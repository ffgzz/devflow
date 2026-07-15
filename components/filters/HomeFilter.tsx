"use client";

import { formUrlQuery, removeKeysFromQuery } from "@/lib/url";
import { cn } from "@/lib/utils";
import { HomePageFilters } from "@/constants/filters";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui/button";

const HomeFilter = () => {
  const searchParams = useSearchParams();
  const filterParams = searchParams.get("filter");
  // URL is the source of truth, so browser back/forward also updates the UI.
  const active = filterParams || "newest";
  const router = useRouter();

  // 当用户点击某个过滤器时，更新 active 状态，并且更新 URL 中的 filter 参数，这样用户可以分享当前的过滤状态，或者刷新页面时保持过滤状态。
  const handleTypeClick = (filter: string) => {
    const newUrl =
      filter === active
        ? removeKeysFromQuery({
            params: searchParams.toString(),
            keysToRemove: ["filter", "page", "cursor"],
          })
        : formUrlQuery({
            params: searchParams.toString(),
            key: "filter",
            value: filter.toLowerCase(),
            keysToRemove: ["page", "cursor"],
          });

    router.push(newUrl, { scroll: false });
  };

  return (
    <div className="mt-10 hidden flex-wrap gap-3 sm:flex">
      {HomePageFilters.map((filter) => (
        <Button
          key={filter.name}
          onClick={() => handleTypeClick(filter.value)}
          className={cn(
            `body-medium rounded-lg px-6 py-3 capitalize shadow-none`,
            active === filter.value
              ? "bg-primary-100 text-primary-500 dark:bg-dark-400"
              : "bg-light-800 text-light-500 hover:bg-light-800 dark:bg-dark-300 dark:text-dark-500 dark:hover:bg-dark-300",
          )}
        >
          {filter.name}
        </Button>
      ))}
    </div>
  );
};

export default HomeFilter;
