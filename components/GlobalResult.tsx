"use client";

import { Loader2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { globalSearch } from "@/lib/actions/general.action";

import GlobalFilter from "./filters/GlobalFilter";

const renderLink = (type: GlobalSearchedItem["type"], id: string) => {
  switch (type) {
    case "question":
      return `/questions/${id}`;
    case "answer":
      return `/questions/${id}`;
    case "user":
      return `/profile/${id}`;
    case "tag":
      return `/tags/${id}`;
    default:
      return "/";
  }
};

const GlobalResult = () => {
  const searchParams = useSearchParams();

  const [result, setResult] = useState<GlobalSearchedItem[]>([]);
  const [isLoading, setLoading] = useState(true);

  const global = searchParams.get("global");
  const typeParam = searchParams.get("type");
  const type = ["question", "answer", "user", "tag"].includes(
    typeParam ?? "",
  )
    ? (typeParam as "question" | "answer" | "user" | "tag")
    : null;

  // 这个 useEffect 用于监听 global 和 type 查询参数的变化，并根据这些参数执行全局搜索。
  // 当 global 参数存在时，组件会调用 globalSearch 函数来获取搜索结果，并更新 result 状态以显示这些结果。同时，组件还管理 isLoading 状态来显示加载指示器，直到搜索结果返回或发生错误。这个机制确保了用户在输入搜索内容或更改搜索类型时能够及时看到相应的搜索结果。
  useEffect(() => {
    const fetchResult = async () => {
      // 在执行搜索之前，组件会先清空当前的搜索结果并设置加载状态为 true，以便在等待搜索结果返回时显示加载指示器。
      setResult([]);
      setLoading(true);

      try {
        const res = await globalSearch({
          query: global as string,
          type,
        });

        setResult(res.success ? res.data || [] : []);
      } catch {
        setResult([]);
      } finally {
        setLoading(false);
      }
    };

    if (global) {
      fetchResult();
    }
  }, [global, type]);

  return (
    <div className="absolute top-full z-10 mt-3 w-full rounded-xl bg-light-800 py-5 shadow-sm dark:bg-dark-400">
      <GlobalFilter />
      <div className="my-5 h-px bg-light-700/50 dark:bg-dark-500/50" />

      <div className="space-y-5">
        <p className="text-dark400_light900 paragraph-semibold px-5">
          Top Match
        </p>

        {isLoading ? (
          <div className="flex-center flex-col px-5">
            <Loader2Icon className="my-2 size-10 animate-spin text-primary-500" />
            <p className="text-dark200_light800 body-regular">
              Browsing the whole database...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {result.length > 0 ? (
              result.map((item, index) => (
                <Link
                  href={renderLink(item.type, item.id)}
                  key={item.type + item.id + index}
                  className="flex w-full cursor-pointer items-start gap-3 px-5 py-2.5 hover:bg-light-700/50 dark:hover:bg-dark-500/50"
                >
                  <Image
                    src="/icons/tag.svg"
                    alt="tags"
                    width={18}
                    height={18}
                    className="invert-colors mt-1 object-contain"
                  />

                  <div className="flex flex-col">
                    <p className="body-medium text-dark200_light800 line-clamp-1">
                      {item.title}
                    </p>
                    <p className="text-light400_light500 small-medium mt-1 font-bold capitalize">
                      {item.type}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex-center flex-col px-5">
                <p className="text-dark200_light800 body-regular px-5 py-2.5">
                  Oops, no results found
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalResult;
