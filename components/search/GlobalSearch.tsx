"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { formUrlQuery, removeKeysFromQuery } from "@/lib/url";

import GlobalResult from "../GlobalResult";

// GlobalSearch 组件实现了一个全局搜索功能，允许用户在应用的任何页面进行搜索。
// 它使用了 Next.js 的路由和状态管理功能来处理搜索输入和结果的显示。组件包含一个输入框，当用户输入搜索内容时，会更新 URL 中的查询参数，并根据输入内容显示相应的搜索结果。
// 同时，组件还监听点击事件，以便在用户点击输入框外部时关闭搜索结果的显示。
const GlobalSearch = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("global");

  const [search, setSearch] = useState(query || "");
  // isOpen 状态用于控制搜索结果的显示，当用户输入搜索内容时，搜索结果会显示出来；当用户点击输入框外部时，搜索结果会隐藏。
  const [isOpen, setIsOpen] = useState(Boolean(query));
  // searchContainerRef 用于引用搜索组件的 DOM 元素，以便在监听点击事件时判断用户是否点击了输入框外部。
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 这个 useEffect 用于监听点击事件，以便在用户点击输入框外部时关闭搜索结果的显示。
    // 它定义了一个 handleOutsideClick 函数，检查点击事件是否发生在搜索容器之外，
    // 如果是，则关闭搜索结果并清空搜索输入。这个事件监听器在组件挂载时添加，在组件卸载时移除，以避免内存泄漏。
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("click", handleOutsideClick);

    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  // 这个 useEffect 用于监听 search 状态的变化，并根据用户输入的搜索内容更新 URL 中的查询参数。
  // 当 search 状态发生变化时，组件会等待 300 毫秒（防抖动），然后检查 search 是否有值。如果有值，则使用 formUrlQuery 函数构建一个新的 URL 查询字符串，并将其添加到 URL 中；
  // 如果 search 为空且原来有查询参数，则使用 removeKeysFromQuery 函数从 URL 中移除相关的查询参数。这个机制确保了用户输入的搜索内容能够正确地反映在 URL 中，同时也避免了频繁更新 URL 导致的性能问题。
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (search) {
        const newUrl = formUrlQuery({
          params: searchParams.toString(),
          key: "global",
          value: search,
        });

        router.push(newUrl, { scroll: false });
      } else if (query) {
        const newUrl = removeKeysFromQuery({
          params: searchParams.toString(),
          keysToRemove: ["global", "type"],
        });

        router.push(newUrl, { scroll: false });
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, pathname, router, searchParams, query]);

  return (
    <div
      className="relative w-full max-w-[600px] max-lg:hidden"
      ref={searchContainerRef}
    >
      <div className="background-light800_darkgradient relative flex min-h-[56px] grow items-center gap-1 rounded-xl px-4">
        <Image
          src="/icons/search.svg"
          alt="search"
          width={24}
          height={24}
          className="cursor-pointer"
        />

        <Input
          type="text"
          placeholder="Search anything globally..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            if (!isOpen) setIsOpen(true);
            // 当用户清空输入框时，关闭搜索结果的显示。
            if (event.target.value === "" && isOpen) setIsOpen(false);
          }}
          className="paragraph-regular no-focus placeholder text-dark400_light700 border-none shadow-none outline-none"
        />
      </div>

      {isOpen && <GlobalResult />}
    </div>
  );
};

export default GlobalSearch;
