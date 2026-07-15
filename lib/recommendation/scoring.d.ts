export type BehaviorAction =
  | "view"
  | "upvote"
  | "downvote"
  | "bookmark"
  | "post"
  | "answer";

export type RecommendationReasonCode =
  | "saved_tag"
  | "upvoted_tag"
  | "answered_tag"
  | "posted_tag"
  | "recent_activity"
  | "trending";

export type RecommendationDate = Date | string | number;

export interface RecommendationTag {
  _id?: unknown;
  id?: unknown;
  name?: string;
}

export interface RecommendationSignal {
  action: BehaviorAction | string;
  createdAt: RecommendationDate;
  tags?: ReadonlyArray<string | RecommendationTag>;
  tagIds?: ReadonlyArray<string | RecommendationTag>;
}

export interface InterestProfile {
  readonly tags: Readonly<Record<string, number>>;
  readonly tagSources: Readonly<
    Record<string, Exclude<BehaviorAction, "downvote">>
  >;
  readonly signalCount: number;
  readonly positiveSignalCount: number;
}

export interface RecommendationCandidate {
  id?: unknown;
  _id?: unknown;
  createdAt: RecommendationDate;
  tags?: ReadonlyArray<string | RecommendationTag>;
  views?: number;
  upvotes?: number;
  downvotes?: number;
  answers?: number;
  [key: string]: unknown;
}

export interface RecommendationScoreBreakdown {
  readonly affinity: number;
  readonly interest: number;
  readonly trend: number;
  readonly freshness: number;
}

export interface RecommendationReason {
  readonly code: RecommendationReasonCode;
  readonly label: string;
  readonly tagId?: string;
  readonly sourceAction?: Exclude<BehaviorAction, "downvote">;
}

export interface RecommendationRanking {
  readonly id: string;
  readonly recommendationScore: number;
  readonly scoreBreakdown: RecommendationScoreBreakdown;
  readonly recommendationReason: RecommendationReason;
}

export type ScoredQuestion<T extends RecommendationCandidate> = Readonly<
  T & RecommendationRanking
>;

export type RankedItem = {
  id?: unknown;
  _id?: unknown;
  createdAt: RecommendationDate;
} & (
  | { recommendationScore: number; score?: number }
  | { score: number; recommendationScore?: number }
);

export const RECOMMENDATION_HALF_LIFE_DAYS: 30;
export const RECOMMENDATION_SCORE_SCALE: 100000;
export const BEHAVIOR_WEIGHTS: Readonly<Record<BehaviorAction, number>>;
export const RECOMMENDATION_REASON_CODES: Readonly<{
  savedTag: "saved_tag";
  upvotedTag: "upvoted_tag";
  answeredTag: "answered_tag";
  postedTag: "posted_tag";
  recentActivity: "recent_activity";
  trending: "trending";
}>;

export function timeDecay(
  occurredAt: RecommendationDate,
  asOf: RecommendationDate,
  halfLifeDays?: number,
): number;

export function quantizeScore(rawScore: number): number;

export function buildInterestProfile(
  signals: ReadonlyArray<RecommendationSignal>,
  asOf: RecommendationDate,
): InterestProfile;

export function buildRecommendationReason(
  candidate: RecommendationCandidate,
  profile: InterestProfile,
  breakdown: RecommendationScoreBreakdown,
): RecommendationReason;

export function scoreQuestion<T extends RecommendationCandidate>(
  candidate: T,
  profile: InterestProfile,
  asOf: RecommendationDate,
): ScoredQuestion<T>;

export function compareRankedItems(a: RankedItem, b: RankedItem): number;

export function isAfterCursor(item: RankedItem, cursor: RankedItem): boolean;

export function rankQuestions<T extends RecommendationCandidate>(
  candidates: ReadonlyArray<T>,
  profile: InterestProfile,
  asOf: RecommendationDate,
): Array<ScoredQuestion<T>>;
