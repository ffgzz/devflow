"use client";
// 这个搜索框需要处理用户输入和客户端交互，所以必须是 Client Component。

import { formUrlQuery, removeKeysFromQuery } from "@/lib/url";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "../ui/input";

interface Props {
  imgSrc: string; // 搜索图标的路径
  placeholder: string; // 输入框的占位符文本
  route: string; // 搜索框所在的页面
  otherClasser?: string; // 其他自定义样式类
  iconPosition?: "left" | "right"; // 图标位置，
}

// 通过 URL 来管理状态，这样用户可以分享搜索结果的链接，或者刷新页面时保持搜索状态。
const LocalSearch = ({
  imgSrc,
  placeholder,
  otherClasser,
  route,
  iconPosition = "left",
}: Props) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // 从 URL 中获取查询参数
  const query = searchParams.get("query") || "";
  // 这个状态可以用来控制输入框的值，初始值来自 URL 中的 query 参数，这样用户刷新页面时可以保持输入框中的内容。
  const [searchQuery, setSearchQuery] = useState(query);

  // 当 searchQuery 变化时（也就是用户在输入框中输入内容时），更新 URL 中的查询参数
  useEffect(() => {
    // 确保只有在当前路径是指定的 route 时才更新 URL
    // 主要是为了防御放在 layout/navbar 这种不会随页面切换卸载的位置
    if (pathname !== route) return;
    // 防抖，避免用户输入时频繁更新 URL，只有在用户停止输入一段时间后才更新 URL
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        // 更新 URL 中的查询参数
        const newUrl = formUrlQuery({
          params: searchParams.toString(),
          key: "query",
          value: searchQuery,
        });
        // 使用 router.push 来更新 URL
        // scroll: false 可以防止页面滚动到顶部
        router.push(newUrl, { scroll: false });
      } else {
        // 如果 searchQuery 为空，说明用户清空了输入框，这时我们应该从 URL 中移除 query 参数
        const newUrl = removeKeysFromQuery({
          params: searchParams.toString(),
          keysToRemove: ["query"],
        });
        router.push(newUrl, { scroll: false });
      }
    }, 300);

    // 在 React 的 useEffect 中，如果你设置了一个定时器（比如setTimeout），
    // 你应该在返回的函数中清除这个定时器，以避免内存泄漏或者在组件卸载后继续执行定时器的回调函数。
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  return (
    <div
      className={`background-light800_darkgradient flex min-h-[56px] 
      grow items-center gap-4 rounded-[10px] px-4 ${otherClasser}`}
    >
      {iconPosition === "left" && (
        <Image
          src={imgSrc}
          width={24}
          height={24}
          alt="Search"
          className="cursor-pointer"
        />
      )}
      <Input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="paragraph-regular no-focus placeholder 
        text-dark400_light700 border-none shadow-none outline-none"
      />
      {iconPosition === "right" && (
        <Image
          src={imgSrc}
          width={15}
          height={15}
          alt="Search"
          className="cursor-pointer"
        />
      )}
    </div>
  );
};

export default LocalSearch;
