import { DEFAULT_EMPTY, DEFAULT_ERROR } from "@/constants/states";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { getI18n } from "@/lib/i18n/server";

interface Props<T> {
  success: boolean;
  error?: {
    message: string;
    details?: Record<string, string[]>;
  };
  data?: T[] | null;
  empty?: {
    title: string;
    message: string;
    button?: {
      text: string;
      href: string;
    };
  };
  render: (data: T[]) => React.ReactNode;
}

interface StateSkeletonProps {
  title: string;
  image: {
    light: string;
    dark: string;
    alt: string;
  };
  message: string;
  button?: {
    text: string;
    href: string;
  };
}

// 空状态骨架组件，展示图片、标题、消息和可选的按钮
// 这个组件被 DataRenderer 用来展示请求失败或没有数据时的状态
const StateSkeleton = ({
  title,
  image,
  message,
  button,
}: StateSkeletonProps) => (
  <div
    className="mt-16 flex w-full flex-col items-center 
    justify-center sm:mt-36"
  >
    <>
      <Image
        className="hidden object-contain dark:block"
        src={image.dark}
        alt={image.alt}
        width={270}
        height={200}
      />
      <Image
        className="object-contain dark:hidden"
        src={image.light}
        alt={image.alt}
        width={270}
        height={200}
      />
    </>

    <h2 className="h2-bold text-dark200_light900 mt-8">{title}</h2>
    <p className="body-regular text-dark500_light700 my-3.5 max-w-md text-center">
      {message}
    </p>

    {button && (
      <Link href={button.href}>
        <Button
          className="bg-primary-500 paragraph-medium mt-5 
          min-h-[46px] rounded-lg px-4 py-3 text-light-900 hover:bg-primary-500"
        >
          {button.text}
        </Button>
      </Link>
    )}
  </div>
);

// 逗号是为了告诉编译器“这是泛型，不是 JSX 标签”。也可以写成 <T extends unknown>
const DataRenderer = async <T,>({
  success,
  error,
  data,
  empty = DEFAULT_EMPTY,
  render,
}: Props<T>) => {
  const { t } = await getI18n();
  // 如果请求失败，展示错误状态
  if (!success) {
    return (
      <StateSkeleton
        image={{
          light: "/images/light-error.png",
          dark: "/images/dark-error.png",
          alt: t("Error state Illustration"),
        }}
        title={t(error?.message || DEFAULT_ERROR.title)}
        message={
          error?.details
            ? JSON.stringify(error.details, null, 2)
            : t(DEFAULT_ERROR.message)
        }
        button={{ ...DEFAULT_ERROR.button, text: t(DEFAULT_ERROR.button.text) }}
      />
    );
  }

  // 如果请求成功但没有数据，展示空状态
  if (!data || data.length === 0) {
    return (
      <StateSkeleton
        image={{
          light: "/images/light-illustration.png",
          dark: "/images/dark-illustration.png",
          alt: t("Empty state Illustration"),
        }}
        title={t(empty.title)}
        message={t(empty.message)}
        button={empty.button ? { ...empty.button, text: t(empty.button.text) } : undefined}
      />
    );
  }

  return <div>{render(data)}</div>;
};

export default DataRenderer;
