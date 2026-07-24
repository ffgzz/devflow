import Question from "@/database/question.model";
import Tag from "@/database/tag.model";
import User from "@/database/user.model";
import { dbConnect } from "@/lib/mongoose";
import mongoose from "mongoose";
import { cache } from "react";
import "server-only";

interface SeoTag {
  _id: string;
  name: string;
}

interface SitemapRecord {
  _id: mongoose.Types.ObjectId | string;
  updatedAt?: Date;
  createdAt?: Date;
}

const isValidId = (id: string) => mongoose.isObjectIdOrHexString(id);

export const getTagSeo = cache(async (id: string): Promise<SeoTag | null> => {
  if (!isValidId(id)) return null;

  await dbConnect();
  const tag = await Tag.findById(id).select("name").lean();

  return tag ? (JSON.parse(JSON.stringify(tag)) as SeoTag) : null;
});

export async function getSitemapRecords(limit = 2_000) {
  await dbConnect();

  const [questions, tags, users] = await Promise.all([
    Question.find()
      .select("_id updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean<SitemapRecord[]>(),
    Tag.find()
      .select("_id updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean<SitemapRecord[]>(),
    User.find()
      .select("_id updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean<SitemapRecord[]>(),
  ]);

  return { questions, tags, users };
}
