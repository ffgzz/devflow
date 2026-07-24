import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} Developer Community`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#fdfdfd",
    theme_color: "#ff7000",
    categories: ["developer", "education", "productivity"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/images/site-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
