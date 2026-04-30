import ROUTES from "@/constants/routes";
import { getDevIconClassName } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "../ui/badge";

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
  const iconClass = getDevIconClassName(name);
  const content = (
    <>
      <Badge
        className="subtle-medium background-light800_dark300
          text-light400_light500 rounded-md border-none px-4 py-2 uppercase flex gap-2"
      >
        <div className="flex-center space-x-2">
          <i className={`${iconClass} text-sm`}></i>
          <span>{name}</span>
        </div>

        {remove && (
          <Image
            src="/icons/close.svg"
            width={12}
            height={12}
            alt="close icon"
            className="cursor-pointer invert-0 dark:invert"
            onClick={handleRemove}
          />
        )}
      </Badge>

      {/* 问题数量 */}
      {showCount && (
        <p className={`small-medium text-dark500_light700`}>{questions}</p>
      )}
    </>
  );

  if (compact) {
    return isButton ? (
      // 如果是按钮的话，点击默认会提交表单，所以这里阻止默认行为
      <button
        onClick={(e) => e.preventDefault()}
        className="flex justify-between gap-2"
      >
        {content}
      </button>
    ) : (
      <Link href={ROUTES.TAGS(_id)} className="flex justify-between gap-2">
        {content}
      </Link>
    );
  }
};

export default TagCard;
