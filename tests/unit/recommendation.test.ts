// @vitest-environment node

import {
  buildInterestProfile,
  rankQuestions,
  timeDecay,
} from "@/lib/recommendation/scoring.mjs";
import {
  createFeedContextHash,
  decodeFeedCursor,
  encodeFeedCursor,
  FeedCursorError,
} from "@/lib/recommendation/cursor.mjs";
import { describe, expect, it } from "vitest";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const AS_OF = new Date("2026-07-18T00:00:00.000Z");
const SECRET = "vitest-feed-secret-at-least-sixteen-bytes";

describe("recommendation scoring", () => {
  it("halves a behavior signal after the configured 30-day half-life", () => {
    const thirtyDaysAgo = new Date(AS_OF.getTime() - 30 * DAY_IN_MS);

    expect(timeDecay(AS_OF, AS_OF)).toBe(1);
    expect(timeDecay(thirtyDaysAgo, AS_OF)).toBeCloseTo(0.5, 12);
  });

  it("uses the strongest positive behavior as the explanation source", () => {
    const profile = buildInterestProfile(
      [
        { action: "view", createdAt: AS_OF, tags: ["react"] },
        { action: "bookmark", createdAt: AS_OF, tags: ["react"] },
      ],
      AS_OF,
    );

    const [question] = rankQuestions(
      [
        {
          id: "question-react",
          createdAt: AS_OF,
          tags: [{ id: "react", name: "React" }],
          views: 10,
          upvotes: 2,
          answers: 1,
        },
      ],
      profile,
      AS_OF,
    );

    expect(profile.tagSources).toMatchObject({ react: "bookmark" });
    expect(question.recommendationReason).toMatchObject({
      code: "saved_tag",
      tagId: "react",
      sourceAction: "bookmark",
    });
    expect(question.recommendationScore).toSatisfy(Number.isSafeInteger);
  });

  it("falls back to a trending explanation for a cold-start user", () => {
    const [question] = rankQuestions(
      [
        {
          id: "question-trending",
          createdAt: new Date(AS_OF.getTime() - DAY_IN_MS),
          tags: ["nextjs"],
          views: 500,
          upvotes: 20,
          answers: 5,
        },
      ],
      buildInterestProfile([], AS_OF),
      AS_OF,
    );

    expect(question.recommendationReason.code).toBe("trending");
  });
});

describe("signed feed cursor", () => {
  const contextHash = createFeedContextHash({
    filter: "recommended",
    query: "react",
    audience: "user:test",
  });

  const createCursor = () =>
    encodeFeedCursor(
      {
        asOf: AS_OF,
        score: 123_000,
        createdAt: "2026-07-17T00:00:00.000Z",
        id: "question-123",
        contextHash,
      },
      SECRET,
    );

  it("round-trips a valid cursor in the same feed context", () => {
    const decoded = decodeFeedCursor(createCursor(), {
      secret: SECRET,
      expectedContextHash: contextHash,
      now: AS_OF,
    });

    expect(decoded).toMatchObject({
      id: "question-123",
      score: 123_000,
      contextHash,
    });
  });

  it("rejects a cursor whose signature was changed", () => {
    const [payload, signature] = createCursor().split(".");
    const replacement = signature.startsWith("a") ? "b" : "a";
    const tampered = `${payload}.${replacement}${signature.slice(1)}`;

    expect(() =>
      decodeFeedCursor(tampered, {
        secret: SECRET,
        expectedContextHash: contextHash,
        now: AS_OF,
      }),
    ).toThrow(FeedCursorError);
  });

  it("rejects using a cursor with a different search or audience", () => {
    const differentContext = createFeedContextHash({
      filter: "newest",
      query: "react",
      audience: "anonymous",
    });

    expect(() =>
      decodeFeedCursor(createCursor(), {
        secret: SECRET,
        expectedContextHash: differentContext,
        now: AS_OF,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<FeedCursorError>>({
        code: "CONTEXT_MISMATCH",
      }),
    );
  });
});
