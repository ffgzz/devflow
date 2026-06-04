import { BADGE_CRITERIA } from "@/constants";
import { techMap } from "@/constants/techMap";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// clsx用来拼接，twMerge用来合并 Tailwind CSS 的类名，自动处理冲突和重复的类名，确保最终生成的类名字符串是最简洁和正确的。
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTechDescription(techName: string): string {
  const normalizedTech = techName.replace(/[ .]/g, "").toLowerCase();

  // Mapping technology names to descriptions
  const techDescriptionMap: { [key: string]: string } = {
    javascript:
      "JavaScript is a powerful language for building dynamic, interactive, and modern web applications.",
    typescript:
      "TypeScript adds strong typing to JavaScript, making it great for scalable and maintainable applications.",
    react:
      "React is a popular library for building fast, component-based user interfaces and web applications.",
    nextjs:
      "Next.js is a React framework for building fast, SEO-friendly, and production-grade web applications.",
    nodejs:
      "Node.js is a runtime for building fast and scalable server-side applications using JavaScript.",
    python:
      "Python is a beginner-friendly language known for its versatility and simplicity in various fields.",
    java: "Java is a versatile, cross-platform language widely used in enterprise and Android development.",
    "c++":
      "C++ is a high-performance language ideal for system programming, games, and large-scale applications.",
    git: "Git is a version control system that helps developers track changes and collaborate on code efficiently.",
    docker:
      "Docker simplifies app deployment by containerizing environments, ensuring consistency across platforms.",
    mongodb:
      "MongoDB is a flexible NoSQL database ideal for handling unstructured data and scalable applications.",
    mysql:
      "MySQL is a popular open-source relational database management system known for its stability and performance.",
    postgresql:
      "PostgreSQL is a powerful open-source SQL database known for its scalability and robustness.",
    aws: "Amazon Web Services (AWS) is a cloud computing platform that offers a wide range of services for building, deploying, and managing web and mobile applications.",
  };

  return (
    techDescriptionMap[normalizedTech] ||
    `${techName} is a technology or tool widely used in software development, providing valuable features and capabilities.`
  );
}

export const getDevIconClassName = (techName: string) => {
  // 将技术名称中的空格和点替换掉，并转换为小写，以匹配 Devicon 的类名规范
  const normalizedTechName = techName.replace(/[ .]/g, "").toLowerCase();

  // 如果找不到对应的技术图标，返回一个默认的图标类名
  return `${techMap[normalizedTechName] || "devicon-devicon-plain"} colored`;
};

// 用于将一个 Date 对象转换为一个相对时间的字符串，例如 "5 minutes ago"、"2 hours ago" 等。
export const getTimeStamp = (createdAt: Date) => {
  const date = new Date(createdAt);

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

// 这个函数用于将一个数字格式化为更易读的形式，例如将 1500 格式化为 "1.5K"，将 2000000 格式化为 "2M" 等。
export const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};

// 这个函数用于根据用户的统计数据来评定用户应该获得哪些徽章。它接受一个 criteria 数组，
// 数组里的每一项都是一个评定标准，包含一个 type 字段表示评定的类型（比如 ANSWER_COUNT、QUESTION_COUNT、QUESTION_UPVOTES、TOTAL_VIEWS 等），还有一个 count 字段表示这个类型的数量。
// 函数会根据这些评定标准来计算用户应该获得多少金银铜徽章，并返回一个包含 GOLD、SILVER、BRONZE 字段的对象。
export function assignBadges(params: {
  criteria: {
    type: keyof typeof BADGE_CRITERIA;
    count: number;
  }[];
}) {
  const badgeCounts: BadgeCounts = {
    GOLD: 0,
    SILVER: 0,
    BRONZE: 0,
  };

  const { criteria } = params;

  // 遍历每个评定标准，根据 BADGE_CRITERIA 来计算用户应该获得多少金银铜徽章，并累加到 badgeCounts 对象中。
  criteria.forEach((item) => {
    const { type, count } = item;
    const badgeLevels = BADGE_CRITERIA[type];

    Object.keys(badgeLevels).forEach((level) => {
      // 如果用户在这个评定标准上的数量（count）达到了对应徽章等级的要求（badgeLevels[level]），就给用户加上这个等级的徽章。
      if (count >= badgeLevels[level as keyof typeof badgeLevels]) {
        badgeCounts[level as keyof BadgeCounts] += 1;
      }
    });
  });

  return badgeCounts;
}
