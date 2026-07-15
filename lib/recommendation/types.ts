export const QUESTION_FEED_FILTERS = [
  "newest",
  "popular",
  "unanswered",
  "recommended",
] as const;

export type QuestionFeedFilter = (typeof QUESTION_FEED_FILTERS)[number];

export interface QuestionFeedTag {
  _id: string;
  name: string;
}

export interface QuestionFeedAuthor {
  _id: string;
  name: string;
  image?: string;
}

export interface QuestionListItemDTO {
  _id: string;
  title: string;
  tags: QuestionFeedTag[];
  author: QuestionFeedAuthor;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  answers: number;
  views: number;
}

export type RecommendationReasonCode =
  | "saved_tag"
  | "upvoted_tag"
  | "answered_tag"
  | "posted_tag"
  | "recent_activity"
  | "trending"
  | "newest"
  | "unanswered"
  | "search_match";

export interface RecommendationReason {
  code: RecommendationReasonCode;
  label: string;
  matchedTags: string[];
}

export interface QuestionFeedItem {
  question: QuestionListItemDTO;
  recommendation: RecommendationReason;
}

export interface QuestionFeedPage {
  items: QuestionFeedItem[];
  nextCursor: string | null;
  mode: "personalized" | "cold-start" | "standard";
}

export interface GetQuestionFeedInput {
  userId?: string;
  filter?: QuestionFeedFilter;
  query?: string;
  cursor?: string;
  limit?: number;
}
