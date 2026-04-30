import { techMap } from "@/constants/techMap";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getDevIconClassName = (techName: string) => {
  // 将技术名称中的空格和点替换掉，并转换为小写，以匹配 Devicon 的类名规范
  const normalizedTechName = techName.replace(/[ .]/g, "").toLowerCase();

  // 如果找不到对应的技术图标，返回一个默认的图标类名
  return `${techMap[normalizedTechName] || "devicon-devicon-plain"} colored`;
};

// 用于将一个 Date 对象转换为一个相对时间的字符串，例如 "5 minutes ago"、"2 hours ago" 等。
export const getTimeStamp = (date: Date) => {
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  const units = [
    { label: "year", seconds: 365 * 24 * 60 * 60 },
    { label: "month", seconds: 30 * 24 * 60 * 60 },
    { label: "week", seconds: 7 * 24 * 60 * 60 },
    { label: "day", seconds: 24 * 60 * 60 },
    { label: "hour", seconds: 60 * 60 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ];

  for (const unit of units) {
    const interval = Math.floor(secondsAgo / unit.seconds);
    if (interval >= 1) {
      return `${interval} ${unit.label}${interval > 1 ? "s" : ""} ago`;
    }
  }
  // 如果时间差小于 1 秒，返回 "just now"
  return "just now";
};
