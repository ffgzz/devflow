"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { GlobalSearchFilters } from "@/constants/filters";
import { formUrlQuery } from "@/lib/url";

const GlobalFilter = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeParams = searchParams.get("type");

  const [active, setActive] = useState(typeParams || "");

  // handleTypeClick 函数用于处理用户点击搜索类型按钮时的逻辑。它首先确定下一个激活的类型值，如果用户点击的类型已经是当前激活的类型，则将其设置为 null（表示取消选择）；否则，将其设置为被点击的类型值。然后，函数使用 formUrlQuery 函数构建一个新的 URL 查询字符串，将新的类型值添加到 URL 中，并使用 router.push 方法更新 URL，同时保持页面滚动位置不变。这使得用户能够通过点击不同的搜索类型按钮来过滤搜索结果，并且这些过滤条件会反映在 URL 中，方便用户分享或保存搜索链接。
  const handleTypeClick = (item: string) => {
    const nextValue = active === item ? null : item.toLowerCase();

    setActive(nextValue || "");

    const newUrl = formUrlQuery({
      params: searchParams.toString(),
      key: "type",
      value: nextValue,
    });

    router.push(newUrl, { scroll: false });
  };

  return (
    <div className="flex items-center gap-5 px-5">
      <p className="text-dark400_light900 body-medium">Type:</p>
      <div className="flex gap-3">
        {GlobalSearchFilters.map((item) => (
          <button
            type="button"
            key={item.value}
            className={`light-border-2 small-medium rounded-2xl px-5 py-2 capitalize ${
              active === item.value
                ? "bg-primary-500 text-light-900"
                : "bg-light-700 text-dark-400 hover:text-primary-500 dark:bg-dark-500 dark:text-light-800 dark:hover:text-primary-500"
            }`}
            onClick={() => handleTypeClick(item.value)}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GlobalFilter;
