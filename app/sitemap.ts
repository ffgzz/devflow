import { getSitemapRecords } from "@/lib/dal/seo";
import { absoluteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";

export const revalidate = 3_600;

const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: absoluteUrl("/"),
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: absoluteUrl("/community"),
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    url: absoluteUrl("/tags"),
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    url: absoluteUrl("/jobs"),
    changeFrequency: "daily",
    priority: 0.6,
  },
  {
    url: absoluteUrl("/playground"),
    changeFrequency: "monthly",
    priority: 0.7,
  },
];

const lastModified = (record: { updatedAt?: Date; createdAt?: Date }) =>
  record.updatedAt ?? record.createdAt;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const { questions, tags, users } = await getSitemapRecords();

    return [
      ...staticRoutes,
      ...questions.map((question) => ({
        url: absoluteUrl(`/questions/${question._id.toString()}`),
        lastModified: lastModified(question),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...tags.map((tag) => ({
        url: absoluteUrl(`/tags/${tag._id.toString()}`),
        lastModified: lastModified(tag),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
      ...users.map((user) => ({
        url: absoluteUrl(`/profile/${user._id.toString()}`),
        lastModified: lastModified(user),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    ];
  } catch {
    // Public routes should remain discoverable during a temporary database
    // outage; dynamic records will return on the next revalidation.
    return staticRoutes;
  }
}
