import assert from "node:assert/strict";
import {
  BEHAVIOR_WEIGHTS,
  buildInterestProfile,
  compareRankedItems,
  isAfterCursor,
  rankQuestions,
  scoreQuestion,
  timeDecay,
} from "../lib/recommendation/scoring.mjs";
import {
  createFeedContextHash,
  decodeFeedCursor,
  encodeFeedCursor,
  FeedCursorError,
} from "../lib/recommendation/cursor.mjs";

const DAY = 24 * 60 * 60 * 1_000;
const asOf = new Date("2026-07-14T00:00:00.000Z");
const reactTag = "64b000000000000000000001";
const nextTag = "64b000000000000000000002";

assert.equal(BEHAVIOR_WEIGHTS.bookmark > BEHAVIOR_WEIGHTS.upvote, true);
assert.equal(BEHAVIOR_WEIGHTS.upvote > BEHAVIOR_WEIGHTS.view, true);
assert.equal(BEHAVIOR_WEIGHTS.downvote < 0, true);
assert.equal(timeDecay(asOf, asOf), 1);
assert.ok(
  Math.abs(timeDecay(new Date(asOf.getTime() - 30 * DAY), asOf) - 0.5) < 1e-12,
);
assert.equal(timeDecay(new Date(asOf.getTime() + DAY), asOf), 1);
assert.throws(() => timeDecay("not-a-date", asOf), /valid date/u);

const profile = buildInterestProfile(
  [
    { action: "view", createdAt: asOf, tags: [reactTag] },
    { action: "bookmark", createdAt: asOf, tags: [reactTag] },
    { action: "upvote", createdAt: asOf, tags: [nextTag] },
    { action: "unknown", createdAt: asOf, tags: [nextTag] },
  ],
  asOf,
);
assert.equal(profile.signalCount, 3);
assert.equal(profile.tagSources[reactTag], "bookmark");
assert.equal(profile.tags[reactTag] > profile.tags[nextTag], true);

const reactQuestion = scoreQuestion(
  {
    id: "64c000000000000000000001",
    createdAt: asOf,
    tags: [reactTag],
    views: 50,
    upvotes: 3,
    downvotes: 0,
    answers: 2,
  },
  profile,
  asOf,
);
assert.equal(reactQuestion.recommendationReason.code, "saved_tag");
assert.equal(reactQuestion.recommendationReason.tagId, reactTag);
assert.equal(
  Object.hasOwn(reactQuestion.recommendationReason, "userId"),
  false,
);

const emptyProfile = buildInterestProfile([], asOf);
const trending = rankQuestions(
  [
    {
      id: "64c000000000000000000002",
      createdAt: new Date(asOf.getTime() - DAY),
      tags: [nextTag],
      views: 800,
      upvotes: 15,
      answers: 7,
    },
    {
      id: "64c000000000000000000003",
      createdAt: new Date(asOf.getTime() - 90 * DAY),
      tags: [nextTag],
      views: 800,
      upvotes: 15,
      answers: 7,
    },
  ],
  emptyProfile,
  asOf,
);
assert.equal(trending.length, 2);
assert.equal(trending[0].id, "64c000000000000000000002");
assert.equal(trending[0].recommendationReason.code, "trending");
assert.equal(Number.isSafeInteger(trending[0].recommendationScore), true);

const boundary = [
  {
    id: "64d000000000000000000003",
    createdAt: "2026-07-13T00:00:00.000Z",
    recommendationScore: 100,
  },
  {
    id: "64d000000000000000000002",
    createdAt: "2026-07-13T00:00:00.000Z",
    recommendationScore: 100,
  },
  {
    id: "64d000000000000000000001",
    createdAt: "2026-07-13T00:00:00.000Z",
    recommendationScore: 100,
  },
].sort(compareRankedItems);
assert.deepEqual(
  boundary.map((item) => item.id),
  [
    "64d000000000000000000003",
    "64d000000000000000000002",
    "64d000000000000000000001",
  ],
);

const secret = "week-seven-test-secret-at-least-sixteen-bytes";
const contextHash = createFeedContextHash({
  filter: "recommended",
  query: "react",
  audience: "user:test",
});
const cursorToken = encodeFeedCursor(
  {
    asOf,
    score: boundary[1].recommendationScore,
    createdAt: boundary[1].createdAt,
    id: boundary[1].id,
    contextHash,
  },
  secret,
);
const decoded = decodeFeedCursor(cursorToken, {
  secret,
  expectedContextHash: contextHash,
  now: asOf,
});
assert.equal(decoded.id, boundary[1].id);
assert.deepEqual(
  boundary
    .filter((item) => isAfterCursor(item, decoded))
    .map((item) => item.id),
  [boundary[2].id],
);

const tampered = `${cursorToken.slice(0, -1)}${
  cursorToken.endsWith("a") ? "b" : "a"
}`;
assert.throws(
  () =>
    decodeFeedCursor(tampered, {
      secret,
      expectedContextHash: contextHash,
      now: asOf,
    }),
  FeedCursorError,
);
assert.throws(
  () =>
    decodeFeedCursor(cursorToken, {
      secret,
      expectedContextHash: createFeedContextHash({
        filter: "newest",
        query: "react",
        audience: "user:test",
      }),
      now: asOf,
    }),
  (error) =>
    error instanceof FeedCursorError && error.code === "CONTEXT_MISMATCH",
);
assert.throws(
  () =>
    decodeFeedCursor("a".repeat(1_025), {
      secret,
      expectedContextHash: contextHash,
      now: asOf,
    }),
  (error) =>
    error instanceof FeedCursorError && error.code === "CURSOR_TOO_LONG",
);

process.stdout.write(
  "Week 7 recommendation scoring and cursor checks passed.\n",
);
