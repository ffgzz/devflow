import "server-only";

import Question from "@/database/question.model";
import Tag from "@/database/tag.model";
import type {
  QuestionWorkbenchDraft,
  SimilarQuestion,
} from "@/lib/ai/question-analysis-schema";
import { dbConnect } from "@/lib/mongoose";
import {
  extractQuestionTerms,
  scoreQuestionCandidate,
} from "@/lib/search/question-terms";
import { Types } from "mongoose";

const MAX_TEXT_CANDIDATES = 80;
const MAX_TAG_CANDIDATES = 40;
const MAX_RETURNED_ITEMS = 5;
const QUERY_TIMEOUT_MS = 1_500;

interface CandidateTag {
  _id: Types.ObjectId;
  name: string;
}

interface CandidateDocument {
  _id: Types.ObjectId;
  title: string;
  content: string;
  tags: Types.ObjectId[];
  answers: number;
  upvotes: number;
  acceptedAnswer?: Types.ObjectId | null;
  createdAt?: Date;
}

interface HydratedCandidateDocument extends Omit<CandidateDocument, "tags"> {
  tags: CandidateTag[];
}

interface SimilarityResult {
  items: SimilarQuestion[];
  meta: {
    strategy: "mongodb-text-v1" | "tags-only-v1";
    candidateCount: number;
  };
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const isMissingTextIndexError = (error: unknown) =>
  error instanceof Error &&
  (("code" in error && (error as Error & { code?: number }).code === 27) ||
    /text index required|no text index/iu.test(error.message));

const asCandidateDocuments = (value: unknown) =>
  value as CandidateDocument[];

const boundedContentProjection = {
  $substrCP: [
    {
      $convert: {
        input: "$content",
        to: "string",
        onError: "",
        onNull: "",
      },
    },
    0,
    20_000,
  ],
};

const boundedTitleProjection = {
  $substrCP: [
    {
      $convert: {
        input: "$title",
        to: "string",
        onError: "",
        onNull: "",
      },
    },
    0,
    100,
  ],
};

async function resolveTagIds(tagNames: string[]) {
  if (tagNames.length === 0) return [];

  const tagFilters = tagNames.map((name) => ({
    name: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" },
  }));
  const tags = await Tag.find({ $or: tagFilters })
    .select("_id")
    .limit(3)
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .lean()
    .exec();

  return tags.map((tag) => tag._id as Types.ObjectId);
}

const baseQuestionFilter = (questionId?: string) =>
  questionId ? { _id: { $ne: new Types.ObjectId(questionId) } } : {};

async function queryByTags(tagIds: Types.ObjectId[], questionId?: string) {
  if (tagIds.length === 0) return [];

  const candidates = await Question.aggregate<CandidateDocument>([
    {
      $match: {
        ...baseQuestionFilter(questionId),
        tags: { $in: tagIds },
      },
    },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: MAX_TAG_CANDIDATES },
    {
      $project: {
        title: boundedTitleProjection,
        content: boundedContentProjection,
        tags: { $slice: [{ $ifNull: ["$tags", []] }, 3] },
        answers: 1,
        upvotes: 1,
        acceptedAnswer: 1,
        createdAt: 1,
      },
    },
  ])
    .option({ maxTimeMS: QUERY_TIMEOUT_MS })
    .exec();

  return asCandidateDocuments(candidates);
}

async function queryByText(
  terms: string[],
  questionId?: string,
): Promise<{
  candidates: CandidateDocument[];
  strategy: SimilarityResult["meta"]["strategy"];
}> {
  const safeTextTerms = terms
    .map((term) => term.replace(/[^\p{L}\p{N}_.]/gu, ""))
    .filter((term) => term.length >= 2)
    .slice(0, 20);

  if (safeTextTerms.length < 2) {
    return {
      candidates: [],
      strategy: "tags-only-v1",
    };
  }

  try {
    const candidates = await Question.aggregate<CandidateDocument>([
      {
        $match: {
          ...baseQuestionFilter(questionId),
          $text: { $search: safeTextTerms.join(" ") },
        },
      },
      { $sort: { score: { $meta: "textScore" } } },
      { $limit: MAX_TEXT_CANDIDATES },
      {
        $project: {
          title: boundedTitleProjection,
          content: boundedContentProjection,
          tags: { $slice: [{ $ifNull: ["$tags", []] }, 3] },
          answers: 1,
          upvotes: 1,
          acceptedAnswer: 1,
          createdAt: 1,
        },
      },
    ])
      .option({ maxTimeMS: QUERY_TIMEOUT_MS })
      .exec();

    return {
      candidates: asCandidateDocuments(candidates),
      strategy: "mongodb-text-v1",
    };
  } catch (error) {
    if (!isMissingTextIndexError(error)) throw error;
    return {
      candidates: [],
      strategy: "tags-only-v1",
    };
  }
}

async function hydrateCandidateTags(
  candidates: CandidateDocument[],
): Promise<HydratedCandidateDocument[]> {
  const tagIds = [
    ...new Set(
      candidates.flatMap((candidate) =>
        candidate.tags.map((tagId) => tagId.toString()),
      ),
    ),
  ];
  if (tagIds.length === 0) {
    return candidates.map((candidate) => ({ ...candidate, tags: [] }));
  }

  const tags = await Tag.find({
    _id: { $in: tagIds.map((tagId) => new Types.ObjectId(tagId)) },
  })
    .select("name")
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .lean()
    .exec();
  const tagsById = new Map(
    tags.map((tag) => [tag._id.toString(), tag.name] as const),
  );

  return candidates.map((candidate) => ({
    ...candidate,
    tags: candidate.tags.flatMap((tagId) => {
      const name = tagsById.get(tagId.toString());
      const normalizedName = name?.normalize("NFKC").trim();
      return normalizedName && normalizedName.length <= 30
        ? [{ _id: tagId, name: normalizedName }]
        : [];
    }),
  }));
}

export async function findSimilarQuestions(
  draft: QuestionWorkbenchDraft,
): Promise<SimilarityResult> {
  await dbConnect();

  const titleTerms = extractQuestionTerms(draft.title, 12);
  const contentTerms = extractQuestionTerms(draft.content, 8);
  const terms = [...new Set([...titleTerms, ...contentTerms])];

  if (terms.length < 2 && draft.tags.length === 0) {
    return {
      items: [],
      meta: { strategy: "tags-only-v1", candidateCount: 0 },
    };
  }

  const tagIds = await resolveTagIds(draft.tags);
  const [textResult, tagCandidates] = await Promise.all([
    queryByText(terms, draft.questionId),
    queryByTags(tagIds, draft.questionId),
  ]);
  const uniqueCandidates = new Map<string, CandidateDocument>();

  for (const candidate of [
    ...textResult.candidates,
    ...tagCandidates,
  ].slice(0, MAX_TEXT_CANDIDATES + MAX_TAG_CANDIDATES)) {
    uniqueCandidates.set(candidate._id.toString(), candidate);
  }

  const hydratedCandidates = await hydrateCandidateTags([
    ...uniqueCandidates.values(),
  ]);
  const items = hydratedCandidates
    .map((candidate) =>
      scoreQuestionCandidate(draft, {
        id: candidate._id.toString(),
        title: candidate.title,
        content: candidate.content,
        tags: candidate.tags.map((tag) => ({
          id: tag._id.toString(),
          name: tag.name,
        })),
        answers: Math.max(0, Math.trunc(candidate.answers ?? 0)),
        upvotes: Math.trunc(candidate.upvotes ?? 0),
        hasAcceptedAnswer: Boolean(candidate.acceptedAnswer),
      }),
    )
    .filter((item): item is SimilarQuestion => item !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.hasAcceptedAnswer) - Number(left.hasAcceptedAnswer) ||
        right.upvotes - left.upvotes ||
        left.id.localeCompare(right.id),
    )
    .slice(0, MAX_RETURNED_ITEMS);

  return {
    items,
    meta: {
      strategy: textResult.strategy,
      candidateCount: uniqueCandidates.size,
    },
  };
}

export async function getPopularTagNames(limit = 30): Promise<string[]> {
  await dbConnect();
  const safeLimit = Math.max(1, Math.min(30, Math.floor(limit)));
  const tags = await Tag.find()
    .select("name")
    .sort({ questions: -1, name: 1 })
    .limit(safeLimit * 2)
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .lean()
    .exec();

  const seen = new Set<string>();
  return tags
    .map((tag) => tag.name.normalize("NFKC").trim().toLowerCase())
    .filter((name) => {
      if (
        name.length === 0 ||
        name.length > 30 ||
        !/^[\p{L}\p{N}.+#-]+$/u.test(name) ||
        seen.has(name)
      ) {
        return false;
      }

      seen.add(name);
      return true;
    })
    .slice(0, safeLimit);
}
