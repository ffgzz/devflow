import "server-only";

import Answer from "@/database/answer.model";
import Question from "@/database/question.model";
import Tag from "@/database/tag.model";
import User from "@/database/user.model";
import { dbConnect } from "@/lib/mongoose";
import { extractNormalizedQuestionTerms } from "@/lib/search/question-search-terms.mjs";
import { escapeRegex } from "@/lib/utils";

export const GLOBAL_SEARCH_TYPES = [
  "question",
  "answer",
  "user",
  "tag",
] as const;

export type GlobalSearchType = (typeof GLOBAL_SEARCH_TYPES)[number];

export interface GlobalSearchItem {
  id: string;
  type: GlobalSearchType;
  title: string;
  subtitle: string;
  href: string;
}

export interface GlobalSearchResult {
  items: GlobalSearchItem[];
  query: string;
  type: GlobalSearchType | null;
}

interface SearchGlobalParams {
  query: string;
  type?: GlobalSearchType;
}

interface QuestionSearchDocument {
  _id: { toString(): string };
  title: string;
}

interface UserSearchDocument {
  _id: { toString(): string };
  name: string;
  username: string;
}

interface TagSearchDocument {
  _id: { toString(): string };
  name: string;
  questions?: number;
}

interface AnswerSearchDocument {
  _id: { toString(): string };
  question: { toString(): string };
  content: string;
}

const SEARCH_TIMEOUT_MS = 1_500;
const FILTERED_RESULT_LIMIT = 8;
const MIXED_RESULT_LIMIT = 2;
const ANSWER_SNIPPET_SCAN_LIMIT = 4_000;
const ANSWER_SNIPPET_LENGTH = 120;

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/gu, " ").trim();

/**
 * Build a small, plain-text preview without returning the full answer body to
 * the browser. Only a bounded prefix is inspected so a very large MDX answer
 * cannot create unbounded server-side string work.
 */
function answerSnippet(content: string, query: string) {
  const plainText = normalizeWhitespace(
    content
      .slice(0, ANSWER_SNIPPET_SCAN_LIMIT)
      .replace(/```[\s\S]*?```/gu, " code ")
      .replace(/`([^`]+)`/gu, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
      .replace(/[>#*_~|-]+/gu, " "),
  );

  if (!plainText) return "Matching answer";

  const matchAt = plainText
    .toLocaleLowerCase()
    .indexOf(query.toLocaleLowerCase());
  const start = Math.max(0, matchAt < 0 ? 0 : matchAt - 35);
  const excerpt = plainText.slice(start, start + ANSWER_SNIPPET_LENGTH);

  return `${start > 0 ? "…" : ""}${excerpt}${
    start + ANSWER_SNIPPET_LENGTH < plainText.length ? "…" : ""
  }`;
}

async function searchQuestions(
  query: string,
  limit: number,
): Promise<GlobalSearchItem[]> {
  // This deliberately uses the existing question_similarity_text index. The
  // score is used only for ordering and is never exposed in the client DTO.
  const searchTerms = extractNormalizedQuestionTerms(query, 16, 100).join(" ");
  const questions = (await Question.find(
    { $text: { $search: searchTerms || query } },
    { score: { $meta: "textScore" } },
  )
    .select("_id title")
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .maxTimeMS(SEARCH_TIMEOUT_MS)
    .lean()
    .exec()) as unknown as QuestionSearchDocument[];

  return questions.map((question) => ({
    id: question._id.toString(),
    type: "question",
    title: question.title,
    subtitle: "Question",
    href: `/questions/${question._id.toString()}`,
  }));
}

async function searchUsers(
  query: string,
  limit: number,
): Promise<GlobalSearchItem[]> {
  const prefix = { $regex: `^${escapeRegex(query)}`, $options: "i" };
  const users = (await User.find({
    $or: [{ name: prefix }, { username: prefix }],
  })
    .select("_id name username")
    .sort({ reputation: -1, _id: 1 })
    .limit(limit)
    .maxTimeMS(SEARCH_TIMEOUT_MS)
    .lean()
    .exec()) as unknown as UserSearchDocument[];

  return users.map((user) => ({
    id: user._id.toString(),
    type: "user",
    title: user.name,
    subtitle: `@${user.username}`,
    href: `/profile/${user._id.toString()}`,
  }));
}

async function searchTags(
  query: string,
  limit: number,
): Promise<GlobalSearchItem[]> {
  const tags = (await Tag.find({
    name: { $regex: `^${escapeRegex(query)}`, $options: "i" },
  })
    .select("_id name questions")
    .sort({ questions: -1, _id: 1 })
    .limit(limit)
    .maxTimeMS(SEARCH_TIMEOUT_MS)
    .lean()
    .exec()) as unknown as TagSearchDocument[];

  return tags.map((tag) => ({
    id: tag._id.toString(),
    type: "tag",
    title: tag.name,
    subtitle: `${tag.questions ?? 0} questions`,
    href: `/tags/${tag._id.toString()}`,
  }));
}

async function searchAnswers(
  query: string,
  limit: number,
): Promise<GlobalSearchItem[]> {
  // Answer search is intentionally a bounded contains query: literal regex,
  // short deadline, hard result cap, small projection, and lean documents.
  const answers = (await Answer.find({
    content: { $regex: escapeRegex(query), $options: "i" },
  })
    .select("_id question content")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .maxTimeMS(SEARCH_TIMEOUT_MS)
    .lean()
    .exec()) as unknown as AnswerSearchDocument[];

  return answers.map((answer) => ({
    id: answer._id.toString(),
    type: "answer",
    title: answerSnippet(answer.content, query),
    subtitle: "Answer",
    href: `/questions/${answer.question.toString()}#answer-${answer._id.toString()}`,
  }));
}

export async function searchGlobally({
  query,
  type,
}: SearchGlobalParams): Promise<GlobalSearchResult> {
  await dbConnect();

  const limit = type ? FILTERED_RESULT_LIMIT : MIXED_RESULT_LIMIT;
  const searches: Record<GlobalSearchType, () => Promise<GlobalSearchItem[]>> =
    {
      question: () => searchQuestions(query, limit),
      answer: () => searchAnswers(query, limit),
      user: () => searchUsers(query, limit),
      tag: () => searchTags(query, limit),
    };

  const items = type
    ? await searches[type]()
    : (
        await Promise.all(GLOBAL_SEARCH_TYPES.map((kind) => searches[kind]()))
      ).flat();

  return { items, query, type: type ?? null };
}
