import { z } from "zod";

const mongoIdSchema = z.string().regex(/^[0-9a-f]{24}$/iu, {
  message: "Invalid question ID.",
});

const rawDraftText = (
  minimum: number,
  maximum: number,
  minimumMessage: string,
  maximumMessage: string,
) =>
  z
    .string()
    .max(maximum, maximumMessage)
    .refine((value) => value.trim().length >= minimum, minimumMessage);

export const QuestionWorkbenchDraftSchema = z
  .object({
    // Keep the exact bytes used by the editor. Local draft edits depend on
    // whitespace-sensitive anchors, so validation must not trim the snapshot.
    title: rawDraftText(
      5,
      100,
      "Write at least 5 characters in the title before analyzing.",
      "Title cannot exceed 100 characters.",
    ),
    content: rawDraftText(
      20,
      20_000,
      "Add a little more detail before analyzing your question.",
      "Only the first 20,000 characters can be analyzed.",
    ),
    tags: z
      .array(z.string().trim().min(1).max(30))
      .max(3, "You can add up to 3 tags."),
    questionId: mongoIdSchema.optional(),
  })
  .strict();

export const QUESTION_ANALYSIS_DIMENSION_KEYS = [
  "titleClarity",
  "problemContext",
  "reproducibility",
  "codeAndErrors",
  "expectedVsActual",
] as const;

export type QuestionAnalysisDimensionKey =
  (typeof QUESTION_ANALYSIS_DIMENSION_KEYS)[number];

export const QUESTION_ANALYSIS_DIMENSION_LABELS: Record<
  QuestionAnalysisDimensionKey,
  string
> = {
  titleClarity: "Title clarity",
  problemContext: "Problem context",
  reproducibility: "Reproducibility",
  codeAndErrors: "Code and errors",
  expectedVsActual: "Expected vs. actual",
};

const QuestionAnalysisDimensionSchema = z
  .object({
    score: z.number().min(0).max(20),
    feedback: z.string().trim().min(1).max(220),
  })
  .strict();

export const DraftEditCategorySchema = z.enum([
  "clarity",
  "context",
  "reproduction",
  "expected-vs-actual",
  "formatting",
]);

export const DraftEditProposalSchema = z
  .object({
    target: z.enum(["title", "content"]),
    // Do not trim anchors or replacements: Markdown indentation and boundary
    // newlines are meaningful and must survive a round trip through the model.
    before: z
      .string()
      .max(800)
      .refine((value) => value.trim().length > 0, "Edit anchor is empty."),
    after: z
      .string()
      .max(1_200)
      .refine((value) => value.trim().length > 0, "Edit replacement is empty."),
    category: DraftEditCategorySchema,
    label: z.string().trim().min(1).max(60),
    reason: z.string().trim().min(1).max(180),
  })
  .strict();

export const DraftEditSchema = DraftEditProposalSchema.extend({
  id: z.string().uuid(),
}).strict();

export const QuestionAnalysisModelOutputSchema = z
  .object({
    dimensions: z
      .object({
        titleClarity: QuestionAnalysisDimensionSchema,
        problemContext: QuestionAnalysisDimensionSchema,
        reproducibility: QuestionAnalysisDimensionSchema,
        codeAndErrors: QuestionAnalysisDimensionSchema,
        expectedVsActual: QuestionAnalysisDimensionSchema,
      })
      .strict(),
    missingItems: z
      .array(
        z
          .object({
            id: z.enum([
              "environment",
              "error-message",
              "minimal-example",
              "expected-result",
              "actual-result",
              "attempts",
            ]),
            severity: z.enum(["required", "recommended"]),
            label: z.string().trim().min(1).max(60),
            reason: z.string().trim().min(1).max(180),
            suggestion: z.string().trim().min(1).max(180),
          })
          .strict(),
      )
      .max(6),
    tagSuggestions: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(30),
            confidence: z.number().min(0).max(1),
            reason: z.string().trim().min(1).max(160),
          })
          .strict(),
      )
      .max(5),
    draftEdits: z.array(DraftEditProposalSchema).max(6),
    summary: z.string().trim().min(1).max(260),
  })
  .strict();

export const QuestionAnalysisSchema = QuestionAnalysisModelOutputSchema.omit({
  draftEdits: true,
})
  .extend({
    draftEdits: z.array(DraftEditSchema).max(4),
    qualityScore: z.number().int().min(0).max(100),
  })
  .strict();

export const QuestionAnalysisPartialSchema =
  QuestionAnalysisModelOutputSchema.deepPartial();

export const AIQuotaSchema = z
  .object({
    hourLimit: z.number().int().positive(),
    hourRemaining: z.number().int().nonnegative(),
    hourResetAt: z.string().datetime(),
    dayLimit: z.number().int().positive(),
    dayRemaining: z.number().int().nonnegative(),
    dayResetAt: z.string().datetime(),
  })
  .strict();

export const AIQuotaResponseSchema = z
  .object({
    success: z.literal(true),
    data: AIQuotaSchema,
  })
  .strict();

export const SimilarQuestionReasonSchema = z
  .object({
    type: z.enum([
      "shared_title_terms",
      "shared_content_terms",
      "shared_tags",
      "similar_title",
    ]),
    label: z.string().min(1).max(80),
    values: z.array(z.string().min(1).max(40)).max(4),
  })
  .strict();

export const SimilarQuestionSchema = z
  .object({
    id: mongoIdSchema,
    title: z.string().min(1).max(100),
    score: z.number().int().min(0).max(100),
    tags: z.array(
      z
        .object({
          id: mongoIdSchema,
          name: z.string().min(1).max(30),
        })
        .strict(),
    ),
    answers: z.number().int().nonnegative(),
    upvotes: z.number().int(),
    hasAcceptedAnswer: z.boolean(),
    reasons: z.array(SimilarQuestionReasonSchema).min(1).max(4),
  })
  .strict();

export const SimilarQuestionResponseSchema = z
  .object({
    success: z.literal(true),
    data: z
      .object({
        items: z.array(SimilarQuestionSchema).max(5),
        meta: z
          .object({
            strategy: z.enum(["mongodb-text-v1", "tags-only-v1"]),
            candidateCount: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const StreamEventBaseSchema = z.object({
  v: z.literal(2),
  requestId: z.string().uuid(),
});

export const QuestionAnalysisStreamEventSchema = z.discriminatedUnion("type", [
  StreamEventBaseSchema.extend({
    type: z.literal("meta"),
    quota: AIQuotaSchema,
    retryPolicy: z
      .object({
        maxAttempts: z.number().int().min(1).max(2),
        attemptsShareQuota: z.literal(true),
      })
      .strict(),
  }).strict(),
  StreamEventBaseSchema.extend({
    type: z.literal("attempt"),
    attempt: z.number().int().min(1).max(2),
    maxAttempts: z.number().int().min(1).max(2),
  }).strict(),
  StreamEventBaseSchema.extend({
    type: z.literal("retry"),
    attempt: z.number().int().min(1).max(2),
    nextAttempt: z.number().int().min(2).max(2),
    maxAttempts: z.number().int().min(2).max(2),
    delayMs: z.number().int().min(0).max(5_000),
    reason: z.enum([
      "AI_TIMEOUT",
      "AI_PROVIDER_UNAVAILABLE",
      "AI_INVALID_OUTPUT",
    ]),
  }).strict(),
  StreamEventBaseSchema.extend({
    type: z.literal("partial"),
    attempt: z.number().int().min(1).max(2),
    seq: z.number().int().positive(),
    data: QuestionAnalysisPartialSchema,
  }).strict(),
  StreamEventBaseSchema.extend({
    type: z.literal("complete"),
    attempt: z.number().int().min(1).max(2),
    data: QuestionAnalysisSchema,
  }).strict(),
  StreamEventBaseSchema.extend({
    type: z.literal("error"),
    attempt: z.number().int().min(1).max(2),
    error: z
      .object({
        code: z.enum([
          "AI_TIMEOUT",
          "AI_PROVIDER_UNAVAILABLE",
          "AI_INVALID_OUTPUT",
          "AI_ABORTED",
        ]),
        message: z.string().min(1).max(200),
        retryable: z.boolean(),
      })
      .strict(),
  }).strict(),
]);

export type QuestionWorkbenchDraft = z.infer<
  typeof QuestionWorkbenchDraftSchema
>;
export type QuestionAnalysisModelOutput = z.infer<
  typeof QuestionAnalysisModelOutputSchema
>;
export type QuestionAnalysis = z.infer<typeof QuestionAnalysisSchema>;
export type DraftEditProposal = z.infer<typeof DraftEditProposalSchema>;
export type DraftEdit = z.infer<typeof DraftEditSchema>;
export type QuestionAnalysisPartial = z.infer<
  typeof QuestionAnalysisPartialSchema
>;
export type AIQuota = z.infer<typeof AIQuotaSchema>;
export type AIQuotaResponse = z.infer<typeof AIQuotaResponseSchema>;
export type SimilarQuestion = z.infer<typeof SimilarQuestionSchema>;
export type SimilarQuestionReason = z.infer<typeof SimilarQuestionReasonSchema>;
export type SimilarQuestionResponse = z.infer<
  typeof SimilarQuestionResponseSchema
>;
export type QuestionAnalysisStreamEvent = z.infer<
  typeof QuestionAnalysisStreamEventSchema
>;
