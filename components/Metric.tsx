import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

// 这个组件是用于展示点赞、回答数、浏览数等指标的
interface Props {
  imgUrl: string; // 图标的 URL
  alt: string; // 图标的替代文本
  value: number | string; // 指标的数值
  title: string; // 指标的标题，比如数值后面的 "Votes"、"Answers"、"Views"
  imgStyles?: string; // 可选的图标样式类
  textStyles?: string; // 可选的文本样式类
  href?: string; // 可选的链接地址，如果提供了这个属性，整个组件应该是可点击的，并且会导航到这个链接
  titleStyles?: string; // 可选的标题样式类
}

const Metric = ({
  imgUrl,
  alt,
  value,
  title,
  imgStyles,
  textStyles,
  href,
  titleStyles,
}: Props) => {
  const metricContent = (
    <>
      <Image
        src={imgUrl}
        width={16}
        height={16}
        alt={alt}
        className={`rounded-full object-contain ${imgStyles}`}
      />

      <p className={`flex items-center gap-1 ${textStyles}`}>
        {value}
        {title ? (
          <span className={cn(`small-regular line-clamp-1`, titleStyles)}>
            {title}
          </span>
        ) : null}
      </p>
    </>
  );

  // 如果是作者信息需要能点击跳转，所以要包一层 Link，其他的不用
  return href ? (
    <Link className="flex-center gap-1" href={href}>
      {metricContent}
    </Link>
  ) : (
    <div className="flex-center gap-1">{metricContent}</div>
  );
};

export default Metric;
