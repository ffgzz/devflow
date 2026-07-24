import type { Metadata } from "next";

export const SITE_NAME = "DevFlow";

export const SITE_DESCRIPTION =
  "A developer community for asking programming questions, sharing practical answers, and running frontend code in an isolated browser lab.";

const FALLBACK_SITE_URL = "http://localhost:3000";

const normalizeSiteUrl = (value?: string) => {
  if (!value) return null;

  try {
    const candidate = value.includes("://") ? value : `https://${value}`;
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    return new URL(url.origin);
  } catch {
    return null;
  }
};

export const SITE_URL =
  normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL) ??
  normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  normalizeSiteUrl(process.env.VERCEL_URL) ??
  new URL(FALLBACK_SITE_URL);

export const absoluteUrl = (pathname = "/") =>
  new URL(pathname, SITE_URL).toString();

export const createPageMetadata = ({
  title,
  description,
  pathname,
}: {
  title: string;
  description: string;
  pathname: string;
}): Metadata => ({
  title,
  description,
  alternates: { canonical: pathname },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: pathname,
    siteName: SITE_NAME,
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
});

export const toPlainText = (value: string, maxLength = 180) => {
  const normalized = value
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<[^>]*>/gu, " ")
    .replace(/[`*_>#~|-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const serializeJsonLd = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</gu, "\\u003c")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
