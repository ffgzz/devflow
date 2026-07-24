"use client";

import ROUTES from "@/constants/routes";
import { cn, getDevIconClassName, getTechDescription } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { useI18n } from "@/lib/i18n/client";

interface Props {
  _id: string;
  name: string;
  questions?: number; // 问题数量
  showCount?: boolean; // 是否显示问题数量
  compact?: boolean; // 是否紧凑模式
  isButton?: boolean; // 是否作为按钮使用（提问表单里的 tag）
  remove?: boolean; // 是否显示移除按钮
  handleRemove?: () => void; // 移除标签的回调函数
}

const TagCard = ({
  _id,
  name,
  questions,
  showCount,
  compact,
  isButton,
  remove,
  handleRemove,
}: Props) => {
  const { t } = useI18n();
  const iconClass = getDevIconClassName(name);
  // getTechDescription 是一个实用函数，用于根据技术名称获取对应的描述信息。它通常会返回一个字符串，描述该技术的特点、用途或者相关信息。在 TagCard 组件中，我们可以使用这个函数来为每个标签提供一个简短的描述，帮助用户更好地理解这个标签代表的技术或者主题。
  const iconDescription = getTechDescription(name);

  const content = (
    <>
      <Badge
        className="subtle-medium background-light800_dark300
          text-light400_light500 rounded-md border-none px-4 py-2 uppercase flex gap-2"
      >
        <div className="flex-center space-x-2">
          <i className={`${iconClass} text-sm`} aria-hidden="true" />
          <span>{name}</span>
        </div>

        {remove && (
          <Image
            src="/icons/close.svg"
            width={12}
            height={12}
            alt=""
            aria-hidden="true"
            className="invert-0 dark:invert"
          />
        )}
      </Badge>

      {/* 问题数量 */}
      {showCount && (
        <p className={`small-medium text-dark500_light700`}>{questions}</p>
      )}
    </>
  );

  // 紧凑版本
  if (compact) {
    return isButton ? (
      // 如果是按钮的话，点击默认会提交表单，所以这里阻止默认行为
      <button
        type="button"
        aria-label={t("Remove {name} tag", { name })}
        onClick={(event) => {
          event.preventDefault();
          handleRemove?.();
        }}
        className="flex justify-between gap-2"
      >
        {content}
      </button>
    ) : (
      <Link href={ROUTES.TAG(_id)} className="flex justify-between gap-2">
        {content}
      </Link>
    );
  }

  return (
    <Link className="shadow-light100_darknone" href={ROUTES.TAG(_id)}>
      <article
        className="background-light900_dark200 light-border flex w-full 
        flex-col rounded-2xl border px-8 py-10 sm:w-[260px]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="background-light800_dark400 w-fit rounded-sm px-5 py-1.5">
            <p className="paragraph-semibold text-dark300_light900">{name}</p>
          </div>
          {/* aria-hidden是一个无障碍属性，表示这个元素对辅助技术隐藏，常用于装饰图标、视觉符号，避免屏幕阅读器读出无意义内容 */}
          <i className={cn(iconClass, "text-2xl")} aria-hidden />
        </div>

        <p className="small-regular text-dark500_light700 mt-5 w-full line-clamp-3">
          {t(iconDescription)}
        </p>

        <p className="small-medium text-dark400_light500 mt-3.5">
          <span className="body-semibold primary-text-gradient mr-2.5">
            {questions}+
          </span>
          {t("Questions")}
        </p>
      </article>
    </Link>
  );
};

export default TagCard;
