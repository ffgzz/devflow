"use client";
// 这个组件需要交互，所以是客户端组件

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formUrlQuery } from "@/lib/url";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

interface Filter {
  name: string;
  value: string;
}

interface Props {
  filters: Filter[];
  otherClasses?: string;
  containerClasses?: string;
  fallbackValue?: string;
}

const CommonFilter = ({
  filters,
  otherClasses = "",
  containerClasses = "",
  fallbackValue,
}: Props) => {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();

  const paramsFilter = searchParams.get("filter");

  // 当用户选择一个新的筛选条件时，我们需要更新 URL 中的 searchParams 来反映这个变化，这样页面就会根据新的筛选条件重新加载数据。
  const handleUpdateParams = (value: string) => {
    // 这个函数用来生成一个新的 URL 查询字符串，它会保留现有的查询参数，并更新指定的 key（这里是 "filter"）为新的 value。
    const newUrl = formUrlQuery({
      params: searchParams.toString(),
      key: "filter",
      value,
      keysToRemove: ["page", "cursor"],
    });
    // 使用 router.push 来导航到新的 URL，同时保持页面滚动位置不变
    router.push(newUrl, { scroll: false });
  };

  return (
    <div className={containerClasses}>
      <Select
        onValueChange={handleUpdateParams}
        value={paramsFilter || fallbackValue || undefined}
      >
        <SelectTrigger
          className={cn(
            "body-regular no-focus light-border background-light800_dark300 text-dark500_light700 border px-5 py-2.5",
            otherClasses,
          )}
        >
          <div className="line-clamp-1 flex-1 text-left">
            <SelectValue placeholder={t("Filter")} />
          </div>
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            {filters.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {t(filter.name)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default CommonFilter;
