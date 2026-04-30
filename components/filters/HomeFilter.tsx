"use client";

import { formUrlQuery, removeKeysFromQuery } from "@/lib/url";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/button";

const filters = [
  { name: "React", value: "react" },
  { name: "JavaScript", value: "javascript" },
  { name: "Unanswered", value: "unanswered" },
  { name: "Recommended", value: "recommended" },
];

const HomeFilter = () => {
  const searchParams = useSearchParams();
  const filterParams = searchParams.get("filter");
  // active 用来控制哪个过滤器被选中，初始值来自 URL 中的 filter 参数，这样用户刷新页面时可以保持当前的过滤状态。
  const [active, setActive] = useState(filterParams || "");
  const router = useRouter();

  let newUrl = "";

  // 当用户点击某个过滤器时，更新 active 状态，并且更新 URL 中的 filter 参数，这样用户可以分享当前的过滤状态，或者刷新页面时保持过滤状态。
  const handleTypeClick = (filter: string) => {
    if (filter === active) {
      // 如果 filter 等于 active，说明用户点击了已经选中的过滤器，这时我们应该取消选中，并从 URL 中移除 filter 参数
      setActive("");
      newUrl = removeKeysFromQuery({
        params: searchParams.toString(),
        keysToRemove: ["filter"],
      });
    } else {
      // 否则，用户点击了一个新的过滤器，这时我们应该更新 active，并更新 URL 中的 filter 参数为新的过滤器值
      setActive(filter);
      newUrl = formUrlQuery({
        params: searchParams.toString(),
        key: "filter",
        value: filter.toLowerCase(),
      });
    }
    // 使用 router.push 来更新 URL，scroll: false 可以防止页面滚动到顶部
    router.push(newUrl, { scroll: false });
  };

  return (
    <div className="mt-10 hidden flex-wrap gap-3 sm:flex">
      {filters.map((filter) => (
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
