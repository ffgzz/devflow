"use client";

import { formUrlQuery } from "@/lib/url";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./ui/button";

interface Props {
  page?: number | string;
  isNext?: boolean;
  containerClasses?: string;
}

const Pagination = ({ page = 1, isNext, containerClasses }: Props) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 处理分页导航的函数，根据用户点击的方向（上一页或下一页）来计算新的页码，并更新 URL 中的 page 参数。
  const handleNavigation = (direction: "prev" | "next") => {
    // 下面的元素中已经有判断了，比如当我们在第一页点不了上一页，所以这里数据是合规的
    const nextPageNumber =
      direction === "prev" ? Number(page) - 1 : Number(page) + 1;

    // 构造新的 URL 查询参数，更新 page 参数
    const newUrl = formUrlQuery({
      params: searchParams.toString(),
      key: "page",
      value: nextPageNumber.toString(),
    });
    router.push(newUrl, { scroll: false });
  };

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center gap-2 mt-5",
        containerClasses,
      )}
    >
      {/* 如果不是第一页，显示上一页按钮 */}
      {Number(page) > 1 && (
        <Button
          onClick={() => handleNavigation("prev")}
          className="light-border-2 btn flex min-h-[36px] items-center justify-center gap-2 border"
        >
          <p className="body-medium text-dark200_light800">Prev</p>
        </Button>
      )}

      <div className="flex items-center justify-center rounded-md bg-primary-500 px-3.5 py-2">
        <p className="body-semibold text-light-900">{page}</p>
      </div>

      {/* 如果还有下一页，显示下一页按钮 */}
      {isNext && (
        <Button
          onClick={() => handleNavigation("next")}
          className="light-border-2 btn flex min-h-[36px] items-center justify-center gap-2 border"
        >
          <p className="body-medium text-dark200_light800">Next</p>
        </Button>
      )}
    </div>
  );
};

export default Pagination;
