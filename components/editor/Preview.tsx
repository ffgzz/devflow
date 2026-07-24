import { Code } from "bright";
import Image from "next/image";
import { MDXRemote } from "next-mdx-remote/rsc";
import type { ComponentPropsWithoutRef } from "react";
import { getI18n } from "@/lib/i18n/server";

Code.theme = {
  light: "github-light",
  dark: "github-dark",
  lightSelector: "html.light",
};

const safeImageHosts = new Set([
  "pixnio.com",
  "lh3.googleusercontent.com",
  "avatars.githubusercontent.com",
  "flagsapi.com",
]);

const getSafeLink = (href?: string) => {
  const value = href?.trim();

  if (!value || value.includes("\\")) return null;
  if (value.startsWith("#")) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? value
      : null;
  } catch {
    return null;
  }
};

const getSafeImageSource = (src?: string | Blob) => {
  if (typeof src !== "string") return null;

  const value = src?.trim();

  if (!value || value.includes("\\")) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && safeImageHosts.has(url.hostname)
      ? value
      : null;
  } catch {
    return null;
  }
};

const SafeLink = ({
  href,
  children,
  title,
}: ComponentPropsWithoutRef<"a">) => {
  const safeHref = getSafeLink(href);

  if (!safeHref) return <span>{children}</span>;

  const opensNewTab = safeHref.startsWith("http");

  return (
    <a
      href={safeHref}
      title={title}
      target={opensNewTab ? "_blank" : undefined}
      rel={opensNewTab ? "noopener noreferrer nofollow" : undefined}
    >
      {children}
    </a>
  );
};

const SafeImage = ({
  src,
  alt,
  title,
  blockedText,
  fallbackAlt,
}: ComponentPropsWithoutRef<"img"> & {
  blockedText: string;
  fallbackAlt: string;
}) => {
  const safeSrc = getSafeImageSource(src);

  if (!safeSrc) {
    return (
      <span className="text-dark400_light500 text-sm" role="note">
        {blockedText}
      </span>
    );
  }

  return (
    <Image
      src={safeSrc}
      alt={alt || fallbackAlt}
      title={title}
      width={960}
      height={540}
      sizes="(max-width: 768px) 100vw, 768px"
      className="h-auto max-w-full rounded-lg object-contain"
    />
  );
};

const SafeCodeBlock = ({ children }: ComponentPropsWithoutRef<"pre">) => (
  <Code
    lineNumbers
    className="shadow-light-200 dark:shadow-dark-200"
  >
    {children}
  </Code>
);

const Preview = async ({ content = "" }: { content: string }) => {
  const { t } = await getI18n();
  // Preserve Markdown escaping; only normalize the legacy encoded-space token.
  const formattedContent = content.replace(/&#x20;/g, " ");

  try {
    const renderedContent = await MDXRemote({
      source: formattedContent,
      options: {
        blockJS: true,
        blockDangerousJS: true,
        mdxOptions: {
          // Parse user input as Markdown, never as executable MDX/JSX.
          format: "md",
        },
      },
      components: {
        a: SafeLink,
        img: (props) => (
          <SafeImage
            {...props}
            blockedText={t("Image blocked: untrusted source")}
            fallbackAlt={t("User-provided image")}
          />
        ),
        pre: SafeCodeBlock,
      },
    });

    return (
      <section className="markdown break-words">{renderedContent}</section>
    );
  } catch {
    return (
      <section
        className="markdown text-dark400_light500 break-words rounded-lg border border-dashed p-4"
        role="status"
      >
        {t("This content could not be displayed safely.")}
      </section>
    );
  }
};

export default Preview;
