import type {
  SimilarQuestion,
  SimilarQuestionReason,
} from "@/lib/ai/question-analysis-schema";
import { extractNormalizedQuestionTerms } from "@/lib/search/question-search-terms.mjs";

export const normalizeQuestionText = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/[`*_~>[\](){}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();

export const extractQuestionTerms = (value: string, limit = 24): string[] =>
  extractNormalizedQuestionTerms(value, limit, 20_000);

const sharedTerms = (left: Set<string>, right: Set<string>) =>
  [...left].filter((term) => right.has(term));

const overlapCoefficient = (left: Set<string>, right: Set<string>) => {
  if (left.size === 0 || right.size === 0) return 0;
  return sharedTerms(left, right).length / Math.min(left.size, right.size);
};

const jaccard = (left: Set<string>, right: Set<string>) => {
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = sharedTerms(left, right).length;
  return intersection / (left.size + right.size - intersection);
};

interface SimilarityInput {
  title: string;
  content: string;
  tags: string[];
}

interface SimilarityCandidate {
  id: string;
  title: string;
  content: string;
  tags: Array<{ id: string; name: string }>;
  answers: number;
  upvotes: number;
  hasAcceptedAnswer: boolean;
}

export function scoreQuestionCandidate(
  input: SimilarityInput,
  candidate: SimilarityCandidate,
): SimilarQuestion | null {
  if (!candidate.title.trim()) return null;

  const inputTitle = new Set(extractQuestionTerms(input.title, 16));
  const candidateTitle = new Set(extractQuestionTerms(candidate.title, 16));
  const inputContent = new Set(extractQuestionTerms(input.content, 128));
  const candidateContent = new Set(
    extractQuestionTerms(candidate.content, 128),
  );
  const inputTags = new Set(input.tags.map(normalizeQuestionText));
  const candidateTags = new Set(
    candidate.tags.map((tag) => normalizeQuestionText(tag.name)),
  );

  const titleMatches = sharedTerms(inputTitle, candidateTitle);
  const contentMatches = sharedTerms(inputContent, candidateContent);
  const tagMatches = sharedTerms(inputTags, candidateTags);
  const normalizedInputTitle = normalizeQuestionText(input.title);
  const normalizedCandidateTitle = normalizeQuestionText(candidate.title);
  const hasSimilarPhrase =
    Math.min(normalizedInputTitle.length, normalizedCandidateTitle.length) >=
      12 &&
    (normalizedInputTitle.includes(normalizedCandidateTitle) ||
      normalizedCandidateTitle.includes(normalizedInputTitle));

  const score = Math.min(
    100,
    Math.round(
      overlapCoefficient(inputTitle, candidateTitle) * 50 +
        jaccard(inputTags, candidateTags) * 25 +
        overlapCoefficient(inputContent, candidateContent) * 15 +
        (hasSimilarPhrase ? 10 : 0),
    ),
  );

  const hasTextEvidence =
    titleMatches.length > 0 ||
    contentMatches.length >= 2 ||
    hasSimilarPhrase;
  if (!hasTextEvidence || score < 30) return null;

  const reasons: SimilarQuestionReason[] = [];
  if (titleMatches.length > 0) {
    reasons.push({
      type: "shared_title_terms",
      label: "Shared title keywords",
      values: titleMatches.slice(0, 4),
    });
  }
  if (tagMatches.length > 0) {
    reasons.push({
      type: "shared_tags",
      label: "Shared tags",
      values: tagMatches.slice(0, 4),
    });
  }
  if (contentMatches.length > 0) {
    reasons.push({
      type: "shared_content_terms",
      label: "Shared details",
      values: contentMatches.slice(0, 4),
    });
  }
  if (hasSimilarPhrase) {
    reasons.push({
      type: "similar_title",
      label: "Very similar title wording",
      values: [],
    });
  }

  return {
    id: candidate.id,
    title: candidate.title,
    score,
    tags: candidate.tags,
    answers: candidate.answers,
    upvotes: candidate.upvotes,
    hasAcceptedAnswer: candidate.hasAcceptedAnswer,
    reasons: reasons.slice(0, 4),
  };
}
