import { absoluteUrl, SITE_URL } from "@/lib/seo";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/ask-question",
        "/collection",
        "/notifications",
        "/profile/edit",
        "/questions/*/edit",
        "/sign-in",
        "/sign-up",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL.origin,
  };
}
