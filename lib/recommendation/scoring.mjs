export const RECOMMENDATION_HALF_LIFE_DAYS = 30;
export const RECOMMENDATION_SCORE_SCALE = 100_000;

/**
 * Explicit product weights make the recommendation behavior inspectable and
 * testable. A downvote is deliberately stronger than a passive view, while a
 * bookmark is the strongest positive intent signal.
 */
export const BEHAVIOR_WEIGHTS = Object.freeze({
  view: 1,
  upvote: 4,
  downvote: -5,
  bookmark: 5,
  post: 3,
  answer: 4,
});

export const RECOMMENDATION_REASON_CODES = Object.freeze({
  savedTag: "saved_tag",
  upvotedTag: "upvoted_tag",
  answeredTag: "answered_tag",
  postedTag: "posted_tag",
  recentActivity: "recent_activity",
  trending: "trending",
});

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_ABSOLUTE_RAW_SCORE =
  Number.MAX_SAFE_INTEGER / RECOMMENDATION_SCORE_SCALE;
const POSITIVE_SOURCE_PRIORITY = Object.freeze([
  "bookmark",
  "answer",
  "upvote",
  "post",
  "view",
]);

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asFiniteTimestamp = (value, fieldName) => {
  const timestamp =
    value instanceof Date ? value.getTime() : new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`${fieldName} must be a valid date.`);
  }

  return timestamp;
};

const normalizeIdentifier = (value) => {
  let candidate = value;

  if (isRecord(candidate)) {
    if (typeof candidate.toHexString === "function") {
      candidate = candidate.toHexString();
    } else if (candidate._id !== undefined) candidate = candidate._id;
    else if (candidate.id !== undefined) candidate = candidate.id;
  }

  if (isRecord(candidate) && typeof candidate.toHexString === "function") {
    candidate = candidate.toHexString();
  }

  if (typeof candidate !== "string") return null;

  const normalized = candidate.trim();
  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) return null;

  return normalized;
};

const normalizeTag = (tag) => {
  const id = normalizeIdentifier(tag);
  if (!id) return null;

  const rawName = isRecord(tag) ? tag.name : undefined;
  const name =
    typeof rawName === "string" && rawName.trim()
      ? rawName.trim().slice(0, 80)
      : undefined;

  return { id, name };
};

const uniqueTags = (tags) => {
  if (!Array.isArray(tags)) return [];

  const seen = new Set();
  const result = [];

  for (const value of tags) {
    const tag = normalizeTag(value);
    if (!tag || seen.has(tag.id)) continue;
    seen.add(tag.id);
    result.push(tag);
  }

  return result;
};

const nonNegativeCount = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1_000_000_000, Math.max(0, Math.trunc(value)));
};

const roundComponent = (value) => Math.round(value * 1_000_000) / 1_000_000;

/**
 * Exponential decay with a fixed 30-day half-life by default. Future-dated
 * signals are treated as current instead of receiving an accidental boost.
 */
export function timeDecay(
  occurredAt,
  asOf,
  halfLifeDays = RECOMMENDATION_HALF_LIFE_DAYS,
) {
  const occurredAtMs = asFiniteTimestamp(occurredAt, "occurredAt");
  const asOfMs = asFiniteTimestamp(asOf, "asOf");

  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) {
    throw new TypeError("halfLifeDays must be a positive finite number.");
  }

  const ageInDays = Math.max(0, asOfMs - occurredAtMs) / DAY_IN_MS;
  return 2 ** (-ageInDays / halfLifeDays);
}

/**
 * Converts a floating-point raw score to integer micro-points. Cursors only
 * carry this integer value, avoiding float equality bugs at page boundaries.
 */
export function quantizeScore(rawScore) {
  if (!Number.isFinite(rawScore)) {
    throw new TypeError("rawScore must be a finite number.");
  }

  const bounded = Math.max(
    -MAX_ABSOLUTE_RAW_SCORE,
    Math.min(MAX_ABSOLUTE_RAW_SCORE, rawScore),
  );
  return Math.round(bounded * RECOMMENDATION_SCORE_SCALE);
}

/**
 * Builds a decayed tag-affinity profile from already-authorized behavior
 * signals. Each signal contributes at most once to each of its tags.
 */
export function buildInterestProfile(signals, asOf) {
  if (!Array.isArray(signals)) {
    throw new TypeError("signals must be an array.");
  }

  const asOfMs = asFiniteTimestamp(asOf, "asOf");
  const accumulatedTags = new Map();
  const accumulatedSources = new Map();
  let signalCount = 0;
  let positiveSignalCount = 0;

  for (const signal of signals) {
    if (!isRecord(signal)) continue;

    const weight = BEHAVIOR_WEIGHTS[signal.action];
    if (typeof weight !== "number") continue;

    let decay;
    try {
      decay = timeDecay(signal.createdAt, asOfMs);
    } catch {
      continue;
    }

    const tags = uniqueTags(signal.tags ?? signal.tagIds);
    if (tags.length === 0) continue;

    const contribution = weight * decay;
    for (const tag of tags) {
      accumulatedTags.set(
        tag.id,
        (accumulatedTags.get(tag.id) ?? 0) + contribution,
      );

      if (weight > 0) {
        const sourceTotals = accumulatedSources.get(tag.id) ?? new Map();
        sourceTotals.set(
          signal.action,
          (sourceTotals.get(signal.action) ?? 0) + contribution,
        );
        accumulatedSources.set(tag.id, sourceTotals);
      }
    }

    signalCount += 1;
    if (weight > 0) positiveSignalCount += 1;
  }

  const tags = {};
  const tagSources = {};
  for (const [tagId, affinity] of [...accumulatedTags].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const rounded = roundComponent(affinity);
    if (rounded === 0) continue;

    tags[tagId] = rounded;

    const sourceTotals = accumulatedSources.get(tagId);
    if (sourceTotals) {
      const source = POSITIVE_SOURCE_PRIORITY.map((action, priority) => ({
        action,
        priority,
        contribution: sourceTotals.get(action) ?? 0,
      }))
        .filter(({ contribution }) => contribution > 0)
        .sort(
          (a, b) => b.contribution - a.contribution || a.priority - b.priority,
        )[0];

      if (source) tagSources[tagId] = source.action;
    }
  }

  return Object.freeze({
    tags: Object.freeze(tags),
    tagSources: Object.freeze(tagSources),
    signalCount,
    positiveSignalCount,
  });
}

const getProfileTags = (profile) => {
  if (!isRecord(profile) || !isRecord(profile.tags)) return {};
  return profile.tags;
};

const getCandidateTags = (candidate) =>
  uniqueTags(Array.isArray(candidate.tags) ? candidate.tags : []);

const calculateBreakdown = (candidate, profile, asOf) => {
  const profileTags = getProfileTags(profile);
  const candidateTags = getCandidateTags(candidate);

  let affinity = 0;
  for (const tag of candidateTags) {
    const tagAffinity = profileTags[tag.id];
    if (typeof tagAffinity === "number" && Number.isFinite(tagAffinity)) {
      affinity += tagAffinity;
    }
  }

  // tanh prevents a very active user from making one tag dominate forever.
  const interest = Math.tanh(affinity / 8) * 8;
  const decay = timeDecay(candidate.createdAt, asOf);
  const views = nonNegativeCount(candidate.views);
  const upvotes = nonNegativeCount(candidate.upvotes);
  const downvotes = nonNegativeCount(candidate.downvotes);
  const answers = nonNegativeCount(candidate.answers);

  const positiveEngagement = views * 0.04 + upvotes * 3 + answers * 4;
  const negativeEngagement = downvotes * 2;
  const trendBase =
    Math.log1p(positiveEngagement) - Math.log1p(negativeEngagement) * 0.8;
  const trend = trendBase * decay;
  const freshness = 2 * decay;

  return Object.freeze({
    affinity: roundComponent(affinity),
    interest: roundComponent(interest),
    trend: roundComponent(trend),
    freshness: roundComponent(freshness),
  });
};

const findBestPositiveTag = (candidate, profile) => {
  const profileTags = getProfileTags(profile);
  const tagSources = isRecord(profile?.tagSources) ? profile.tagSources : {};

  return getCandidateTags(candidate)
    .map((tag) => ({
      ...tag,
      affinity: profileTags[tag.id] ?? 0,
      sourceAction: tagSources[tag.id],
    }))
    .filter((tag) => Number.isFinite(tag.affinity) && tag.affinity > 0)
    .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))[0];
};

/**
 * Produces one deterministic, user-facing explanation for a scored item.
 */
export function buildRecommendationReason(candidate, profile, breakdown) {
  if (!isRecord(candidate)) {
    throw new TypeError("candidate must be an object.");
  }

  const bestTag = findBestPositiveTag(candidate, profile);
  if (bestTag && breakdown.interest > 0) {
    const reasonByAction = {
      bookmark: {
        code: RECOMMENDATION_REASON_CODES.savedTag,
        label: "Because you saved questions about {tag}",
      },
      upvote: {
        code: RECOMMENDATION_REASON_CODES.upvotedTag,
        label: "Because you upvoted questions about {tag}",
      },
      answer: {
        code: RECOMMENDATION_REASON_CODES.answeredTag,
        label: "Because you answered questions about {tag}",
      },
      post: {
        code: RECOMMENDATION_REASON_CODES.postedTag,
        label: "Because you posted questions about {tag}",
      },
      view: {
        code: RECOMMENDATION_REASON_CODES.recentActivity,
        label: "Based on your recent activity in {tag}",
      },
    };
    const reason = reasonByAction[bestTag.sourceAction];

    if (reason) {
      return Object.freeze({
        ...reason,
        tagId: bestTag.id,
        sourceAction: bestTag.sourceAction,
      });
    }
  }

  return Object.freeze({
    code: RECOMMENDATION_REASON_CODES.trending,
    label: "Trending in the community",
  });
}

/**
 * Scores one question without I/O, making the algorithm reproducible for a
 * fixed `asOf` snapshot.
 */
export function scoreQuestion(candidate, profile, asOf) {
  if (!isRecord(candidate)) {
    throw new TypeError("candidate must be an object.");
  }

  const id = normalizeIdentifier(candidate.id ?? candidate._id);
  if (!id) throw new TypeError("candidate.id must be a non-empty identifier.");
  asFiniteTimestamp(candidate.createdAt, "candidate.createdAt");

  const scoreBreakdown = calculateBreakdown(candidate, profile, asOf);
  const recommendationScore = quantizeScore(
    scoreBreakdown.interest + scoreBreakdown.trend + scoreBreakdown.freshness,
  );
  const recommendationReason = buildRecommendationReason(
    candidate,
    profile,
    scoreBreakdown,
  );

  return Object.freeze({
    ...candidate,
    id,
    recommendationScore,
    scoreBreakdown,
    recommendationReason,
  });
}

const getRankScore = (item) => {
  const score = item?.recommendationScore ?? item?.score;
  if (!Number.isSafeInteger(score)) {
    throw new TypeError("ranked item score must be a safe integer.");
  }
  return score;
};

const getRankDate = (item) =>
  asFiniteTimestamp(item?.createdAt, "ranked item createdAt");

const getRankId = (item) => {
  const id = normalizeIdentifier(item?.id ?? item?._id);
  if (!id)
    throw new TypeError("ranked item id must be a non-empty identifier.");
  return id;
};

/**
 * A complete descending order: score, creation time, then identifier. The
 * identifier tie-breaker prevents duplicates or gaps when scores are equal.
 */
export function compareRankedItems(a, b) {
  const aScore = getRankScore(a);
  const bScore = getRankScore(b);
  if (aScore !== bScore) return aScore > bScore ? -1 : 1;

  const aCreatedAt = getRankDate(a);
  const bCreatedAt = getRankDate(b);
  if (aCreatedAt !== bCreatedAt) return aCreatedAt > bCreatedAt ? -1 : 1;

  return getRankId(b).localeCompare(getRankId(a));
}

/** Returns true when `item` belongs strictly after a cursor boundary. */
export function isAfterCursor(item, cursor) {
  return compareRankedItems(item, cursor) > 0;
}

/** Scores and orders candidates without mutating the caller's array. */
export function rankQuestions(candidates, profile, asOf) {
  if (!Array.isArray(candidates)) {
    throw new TypeError("candidates must be an array.");
  }

  return candidates
    .map((candidate) => scoreQuestion(candidate, profile, asOf))
    .sort(compareRankedItems);
}
