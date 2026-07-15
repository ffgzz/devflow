import "server-only";

import Answer from "@/database/answer.model";
import Collection from "@/database/collection.model";
import Interaction from "@/database/interaction.model";
import Question from "@/database/question.model";
import RecommendationFeedback from "@/database/recommendation-feedback.model";
import Vote from "@/database/vote.model";
import { dbConnect } from "@/lib/mongoose";
import {
  buildInterestProfile,
  compareRankedItems,
  isAfterCursor,
  scoreQuestion,
} from "@/lib/recommendation/scoring.mjs";
import {
  createFeedContextHash,
  decodeFeedCursor,
  encodeFeedCursor,
} from "@/lib/recommendation/cursor.mjs";
import type {
  GetQuestionFeedInput,
  QuestionFeedFilter,
  QuestionFeedItem,
  QuestionFeedPage,
  QuestionListItemDTO,
  RecommendationReason,
  RecommendationReasonCode,
} from "@/lib/recommendation/types";
import { extractNormalizedQuestionTerms } from "@/lib/search/question-search-terms.mjs";
import { Types } from "mongoose";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const CANDIDATE_LIMIT = 240;
const SIGNAL_LIMIT = 120;
const SIGNAL_WINDOW_MS = 90 * 24 * 60 * 60 * 1_000;
const CURSOR_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const EMPTY_PROFILE = buildInterestProfile([], new Date(0));

type BehaviorAction =
  | "view"
  | "upvote"
  | "downvote"
  | "bookmark"
  | "post"
  | "answer";

interface BehaviorSignal {
  action: BehaviorAction;
  createdAt: Date;
  tags: string[];
}

interface CandidateQuestion {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  tags: Types.ObjectId[];
  createdAt: Date;
  views: number;
  upvotes: number;
  downvotes: number;
  answers: number;
}

interface RankedCandidate {
  id: string;
  createdAt: Date | string;
  recommendationScore: number;
  recommendationReason: {
    code: RecommendationReasonCode;
    label: string;
    tagId?: string;
  };
}

interface PopulatedQuestion {
  _id: Types.ObjectId;
  title: string;
  tags: Array<{ _id: Types.ObjectId; name: string }>;
  author: {
    _id: Types.ObjectId;
    name: string;
    image?: string;
  } | null;
  createdAt: Date;
  upvotes: number;
  downvotes: number;
  answers: number;
  views: number;
}

interface RawSignal {
  action: BehaviorAction;
  questionId: string;
  createdAt: Date | null;
}

const asDate = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const boundedLimit = (value?: number) =>
  Number.isFinite(value)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value!)))
    : DEFAULT_LIMIT;

const normalizeQuery = (query?: string) => query?.trim().slice(0, 100) ?? "";

const getCursorSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 16) {
    throw new Error("AUTH_SECRET must be configured to sign feed cursors");
  }
  return secret;
};

async function loadInterestProfile(userId: string, asOf: Date) {
  const since = new Date(asOf.getTime() - SIGNAL_WINDOW_MS);
  const user = new Types.ObjectId(userId);
  const [rawInteractions, rawVotes, rawCollections, rawAnswers] =
    await Promise.all([
      Interaction.find({
        user,
        actionType: "question",
        action: { $in: ["view", "post"] },
        updatedAt: { $gte: since, $lte: asOf },
      })
        .select("action actionId updatedAt")
        .sort({ updatedAt: -1, _id: -1 })
        .limit(SIGNAL_LIMIT)
        .lean(),
      Vote.find({
        author: user,
        type: "question",
        updatedAt: { $gte: since, $lte: asOf },
      })
        .select("id voteType updatedAt")
        .sort({ updatedAt: -1, _id: -1 })
        .limit(SIGNAL_LIMIT)
        .lean(),
      Collection.find({
        author: user,
        updatedAt: { $gte: since, $lte: asOf },
      })
        .select("question updatedAt")
        .sort({ updatedAt: -1, _id: -1 })
        .limit(SIGNAL_LIMIT)
        .lean(),
      Answer.find({
        author: user,
        createdAt: { $gte: since, $lte: asOf },
      })
        .select("question createdAt")
        .sort({ createdAt: -1, _id: -1 })
        .limit(SIGNAL_LIMIT)
        .lean(),
    ]);

  const interactions = rawInteractions as unknown as Array<{
    action: "view" | "post";
    actionId: Types.ObjectId;
    updatedAt: Date;
  }>;
  const votes = rawVotes as unknown as Array<{
    id: Types.ObjectId;
    voteType: "upvote" | "downvote";
    updatedAt: Date;
  }>;
  const collections = rawCollections as unknown as Array<{
    question: Types.ObjectId;
    updatedAt: Date;
  }>;
  const answers = rawAnswers as unknown as Array<{
    question: Types.ObjectId;
    createdAt: Date;
  }>;

  const rawSignals: RawSignal[] = [
    ...interactions.map((item) => ({
      action: item.action,
      questionId: item.actionId.toString(),
      createdAt: asDate(item.updatedAt),
    })),
    ...votes.map((item) => ({
      action: item.voteType,
      questionId: item.id.toString(),
      createdAt: asDate(item.updatedAt),
    })),
    ...collections.map((item) => ({
      action: "bookmark" as const,
      questionId: item.question.toString(),
      createdAt: asDate(item.updatedAt),
    })),
    ...answers.map((item) => ({
      action: "answer" as const,
      questionId: item.question.toString(),
      createdAt: asDate(item.createdAt),
    })),
  ];
  const validSignals = rawSignals.filter(
    (item): item is RawSignal & { createdAt: Date } => item.createdAt !== null,
  );
  const questionIds = [
    ...new Set(validSignals.map((signal) => signal.questionId)),
  ];
  const questionTags = (await Question.find({ _id: { $in: questionIds } })
    .select("tags")
    .lean()) as unknown as Array<{
    _id: Types.ObjectId;
    tags: Types.ObjectId[];
  }>;
  const tagsByQuestion = new Map(
    questionTags.map((question) => [
      question._id.toString(),
      question.tags.map((tag) => tag.toString()),
    ]),
  );
  const signals: BehaviorSignal[] = validSignals
    .map((signal) => ({
      action: signal.action,
      createdAt: signal.createdAt,
      tags: tagsByQuestion.get(signal.questionId) ?? [],
    }))
    .filter((signal) => signal.tags.length > 0);

  return {
    profile: buildInterestProfile(signals, asOf),
    interactedQuestionIds: questionIds,
  };
}

function reasonLabel(code: RecommendationReasonCode, tagName?: string) {
  const topic = tagName ?? "this topic";
  const labels: Record<RecommendationReasonCode, string> = {
    saved_tag: `Because you saved questions about ${topic}`,
    upvoted_tag: `Because you upvoted questions about ${topic}`,
    answered_tag: `Because you answered questions about ${topic}`,
    posted_tag: `Based on questions you posted about ${topic}`,
    recent_activity: `Based on your recent activity in ${topic}`,
    trending: "Trending in the community right now",
    newest: "Recently asked in the community",
    unanswered: "A new question waiting for an answer",
    search_match: "Matches your current search",
  };
  return labels[code];
}

function toRecommendationReason(
  ranked: RankedCandidate,
  question: PopulatedQuestion,
  filter: QuestionFeedFilter,
  query: string,
): RecommendationReason {
  let code = ranked.recommendationReason.code;
  if (query) code = "search_match";
  else if (filter === "newest") code = "newest";
  else if (filter === "unanswered") code = "unanswered";
  else if (filter === "popular") code = "trending";

  const matchedTag = ranked.recommendationReason.tagId
    ? question.tags.find(
        (tag) => tag._id.toString() === ranked.recommendationReason.tagId,
      )
    : undefined;

  return {
    code,
    label: reasonLabel(code, matchedTag?.name),
    matchedTags: matchedTag ? [matchedTag.name] : [],
  };
}

function toQuestionDTO(
  question: PopulatedQuestion,
): QuestionListItemDTO | null {
  if (!question.author) return null;

  return {
    _id: question._id.toString(),
    title: question.title,
    tags: question.tags.map((tag) => ({
      _id: tag._id.toString(),
      name: tag.name,
    })),
    author: {
      _id: question.author._id.toString(),
      name: question.author.name,
      image: question.author.image,
    },
    createdAt: question.createdAt.toISOString(),
    upvotes: question.upvotes,
    downvotes: question.downvotes,
    answers: question.answers,
    views: question.views,
  };
}

export async function getQuestionFeed(
  input: GetQuestionFeedInput,
): Promise<QuestionFeedPage> {
  await dbConnect();

  const filter = input.filter ?? "newest";
  const query = normalizeQuery(input.query);
  const limit = boundedLimit(input.limit);
  const contextHash = createFeedContextHash({
    filter,
    query: query.toLocaleLowerCase(),
    audience: input.userId ? `user:${input.userId}` : "anonymous",
  });
  const cursor = input.cursor
    ? decodeFeedCursor(input.cursor, {
        secret: getCursorSecret(),
        expectedContextHash: contextHash,
        maxAgeMs: CURSOR_MAX_AGE_MS,
      })
    : null;
  const asOf = cursor ? new Date(cursor.asOf) : new Date();

  const interest =
    input.userId && filter === "recommended"
      ? await loadInterestProfile(input.userId, asOf)
      : { profile: EMPTY_PROFILE, interactedQuestionIds: [] as string[] };
  const hasPersonalization =
    filter === "recommended" && interest.profile.positiveSignalCount > 0;

  const feedbackRows = input.userId
    ? ((await RecommendationFeedback.find({ user: input.userId })
        .select("question")
        .limit(2_000)
        .lean()) as unknown as Array<{ question: Types.ObjectId }>)
    : [];
  const excludedIds = new Set(
    feedbackRows.map((feedback) => feedback.question.toString()),
  );
  if (filter === "recommended" && input.userId) {
    interest.interactedQuestionIds.forEach((id) => excludedIds.add(id));
  }

  const candidateQuery: Record<string, unknown> = {
    createdAt: { $lte: asOf },
  };
  if (filter === "unanswered") candidateQuery.answers = 0;
  if (filter === "recommended" && input.userId) {
    candidateQuery.author = { $ne: new Types.ObjectId(input.userId) };
  }
  if (excludedIds.size > 0) {
    candidateQuery._id = {
      $nin: [...excludedIds].map((id) => new Types.ObjectId(id)),
    };
  }
  if (query) {
    const terms = extractNormalizedQuestionTerms(query, 12, 100).join(" ");
    candidateQuery.$text = { $search: terms || query };
  }

  const candidates = (await Question.find(candidateQuery)
    .select("author tags createdAt views upvotes downvotes answers")
    .sort({ createdAt: -1, _id: -1 })
    .limit(CANDIDATE_LIMIT)
    .maxTimeMS(2_000)
    .lean()) as unknown as CandidateQuestion[];
  const ranked = candidates
    .map((candidate) => {
      const scored = scoreQuestion(
        {
          ...candidate,
          id: candidate._id.toString(),
          tags: candidate.tags.map((tag) => tag.toString()),
        },
        filter === "recommended" ? interest.profile : EMPTY_PROFILE,
        asOf,
      ) as unknown as RankedCandidate;

      if (filter === "newest" || filter === "unanswered") {
        return { ...scored, recommendationScore: 0 };
      }
      return scored;
    })
    .sort(compareRankedItems);
  const remaining = cursor
    ? ranked.filter((item) => isAfterCursor(item, cursor))
    : ranked;
  const hasMore = remaining.length > limit;
  const pageCandidates = remaining.slice(0, limit);
  const pageIds = pageCandidates.map((item) => item.id);
  const populated = (await Question.find({ _id: { $in: pageIds } })
    .select("title tags author createdAt views upvotes downvotes answers")
    .populate("tags", "name")
    .populate("author", "name image")
    .lean()) as unknown as PopulatedQuestion[];
  const questionById = new Map(
    populated.map((question) => [question._id.toString(), question]),
  );
  const items: QuestionFeedItem[] = pageCandidates.flatMap((rankedQuestion) => {
    const question = questionById.get(rankedQuestion.id);
    if (!question) return [];
    const questionDTO = toQuestionDTO(question);
    if (!questionDTO) return [];

    return [
      {
        question: questionDTO,
        recommendation: toRecommendationReason(
          rankedQuestion,
          question,
          filter,
          query,
        ),
      },
    ];
  });

  const last = hasMore ? pageCandidates.at(-1) : null;
  const nextCursor = last
    ? encodeFeedCursor(
        {
          asOf: asOf.toISOString(),
          score: last.recommendationScore,
          createdAt: new Date(last.createdAt).toISOString(),
          id: last.id,
          contextHash,
        },
        getCursorSecret(),
      )
    : null;

  return {
    items,
    nextCursor,
    mode:
      filter !== "recommended"
        ? "standard"
        : hasPersonalization
          ? "personalized"
          : "cold-start",
  };
}
