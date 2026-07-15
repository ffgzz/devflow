"use client";

import {
  fetchAIQuota,
  fetchSimilarQuestions,
  QuestionAnalysisStreamError,
  QuestionWorkbenchRequestError,
  streamQuestionAnalysis,
} from "@/lib/ai/question-analysis-client";
import {
  QuestionWorkbenchDraftSchema,
  type AIQuota,
  type QuestionAnalysis,
  type QuestionAnalysisPartial,
  type QuestionAnalysisStreamEvent,
  type QuestionWorkbenchDraft,
  type SimilarQuestion,
} from "@/lib/ai/question-analysis-schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type QuestionAnalysisStatus =
  | "idle"
  | "streaming"
  | "complete"
  | "cancelled"
  | "error";

type SimilarityStatus = "idle" | "loading" | "complete" | "error";
type QuotaScope = "hour" | "day";
type RetryEvent = Extract<QuestionAnalysisStreamEvent, { type: "retry" }>;

// Title/content stay byte-exact because a local edit anchor may depend on
// leading spaces, Markdown indentation, CRLF, or a trailing newline.
const fingerprintDraft = (draft: QuestionWorkbenchDraft) =>
  JSON.stringify([
    draft.title,
    draft.content,
    draft.tags.map((tag) => tag.normalize("NFKC").trim().toLowerCase()).sort(),
    draft.questionId ?? null,
  ]);

const safeErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export interface QuestionAnalysisErrorState {
  message: string;
  status?: number;
  retryAfterSeconds?: number;
  retryable: boolean;
  code?: string;
  scope?: QuotaScope;
  resetAt?: string;
  quota?: AIQuota;
}

const analysisErrorState = (error: unknown): QuestionAnalysisErrorState => {
  if (error instanceof QuestionWorkbenchRequestError) {
    return {
      message: error.message,
      status: error.status,
      retryAfterSeconds: error.retryAfterSeconds,
      retryable: error.status === 429 || error.status >= 500,
      code: error.code,
      scope: error.scope,
      resetAt: error.resetAt,
      quota: error.quota,
    };
  }

  if (error instanceof QuestionAnalysisStreamError) {
    return {
      message: error.message,
      code: error.code,
      retryable: error.retryable,
    };
  }

  return {
    message: safeErrorMessage(error, "The analysis could not be completed."),
    retryable: true,
  };
};

const quotaBlock = (quota: AIQuota) => {
  if (quota.dayRemaining === 0) {
    return {
      scope: "day" as const,
      until: Date.parse(quota.dayResetAt),
    };
  }
  if (quota.hourRemaining === 0) {
    return {
      scope: "hour" as const,
      until: Date.parse(quota.hourResetAt),
    };
  }
  return undefined;
};

export function useQuestionAnalysis(draft: QuestionWorkbenchDraft) {
  const [status, setStatus] = useState<QuestionAnalysisStatus>("idle");
  const [stage, setStage] = useState(
    "Add a clear title and a few details, then analyze your draft.",
  );
  const [partial, setPartial] = useState<QuestionAnalysisPartial>();
  const [result, setResult] = useState<QuestionAnalysis>();
  const [quota, setQuota] = useState<AIQuota>();
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [error, setError] = useState<QuestionAnalysisErrorState>();
  const [quotaBlockedUntil, setQuotaBlockedUntil] = useState<number>();
  const [quotaScope, setQuotaScope] = useState<QuotaScope>();
  const [attempt, setAttempt] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [retry, setRetry] = useState<RetryEvent>();
  const [similarityStatus, setSimilarityStatus] =
    useState<SimilarityStatus>("idle");
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>(
    [],
  );
  const [similarityError, setSimilarityError] = useState<string>();
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState<string>();
  const [similarityFingerprint, setSimilarityFingerprint] = useState<string>();

  const runIdRef = useRef(0);
  const aiControllerRef = useRef<AbortController | null>(null);
  const similarityControllerRef = useRef<AbortController | null>(null);
  const quotaControllerRef = useRef<AbortController | null>(null);
  const terminalPhaseRef = useRef<QuestionAnalysisStatus>("idle");
  const activeRunFingerprintRef = useRef<string | undefined>(undefined);
  const analyzedFingerprintRef = useRef<string | undefined>(undefined);

  const currentFingerprint = useMemo(() => fingerprintDraft(draft), [draft]);
  const validation = useMemo(
    () => QuestionWorkbenchDraftSchema.safeParse(draft),
    [draft],
  );
  const isAnalysisStale = Boolean(
    analyzedFingerprint && analyzedFingerprint !== currentFingerprint,
  );
  const isSimilarityStale = Boolean(
    similarityFingerprint && similarityFingerprint !== currentFingerprint,
  );
  const isQuotaBlocked = Boolean(
    quotaBlockedUntil && quotaBlockedUntil > Date.now(),
  );

  const applyQuota = useCallback((nextQuota: AIQuota) => {
    setQuota(nextQuota);
    const blocked = quotaBlock(nextQuota);
    if (
      blocked &&
      Number.isFinite(blocked.until) &&
      blocked.until > Date.now()
    ) {
      setQuotaBlockedUntil(blocked.until);
      setQuotaScope(blocked.scope);
    } else {
      setQuotaBlockedUntil(undefined);
      setQuotaScope(undefined);
    }
  }, []);

  const loadQuota = useCallback(async () => {
    quotaControllerRef.current?.abort();
    const controller = new AbortController();
    quotaControllerRef.current = controller;
    setQuotaLoading(true);

    try {
      applyQuota(await fetchAIQuota(controller.signal));
    } catch {
      // Quota is advisory in the browser. The analyze POST remains the
      // authority and returns structured quota data when a request is blocked.
    } finally {
      if (quotaControllerRef.current === controller) {
        quotaControllerRef.current = null;
        setQuotaLoading(false);
      }
    }
  }, [applyQuota]);

  const analyze = useCallback(async () => {
    const parsed = QuestionWorkbenchDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Add more detail first.";
      setError({ message, retryable: false });
      setStatus("error");
      terminalPhaseRef.current = "error";
      setStage("The draft is not ready to analyze yet.");
      return;
    }
    if (quotaBlockedUntil && quotaBlockedUntil > Date.now()) return;

    runIdRef.current += 1;
    const runId = runIdRef.current;
    aiControllerRef.current?.abort();
    similarityControllerRef.current?.abort();
    quotaControllerRef.current?.abort();
    setQuotaLoading(false);

    const aiController = new AbortController();
    const similarityController = new AbortController();
    aiControllerRef.current = aiController;
    similarityControllerRef.current = similarityController;

    const snapshot = parsed.data;
    const snapshotFingerprint = fingerprintDraft(snapshot);
    activeRunFingerprintRef.current = snapshotFingerprint;
    analyzedFingerprintRef.current = snapshotFingerprint;
    terminalPhaseRef.current = "streaming";
    setAnalyzedFingerprint(snapshotFingerprint);
    setSimilarityFingerprint(snapshotFingerprint);
    setStatus("streaming");
    setStage("Reading the question draft...");
    setAttempt(0);
    setMaxAttempts(2);
    setRetry(undefined);
    setPartial(undefined);
    setResult(undefined);
    setError(undefined);
    setSimilarityStatus("loading");
    setSimilarQuestions([]);
    setSimilarityError(undefined);

    void fetchSimilarQuestions(snapshot, similarityController.signal)
      .then((response) => {
        if (runIdRef.current !== runId) return;
        setSimilarQuestions(response.items);
        setSimilarityStatus("complete");
      })
      .catch((similarityRequestError: unknown) => {
        if (runIdRef.current !== runId || similarityController.signal.aborted) {
          return;
        }
        setSimilarityStatus("error");
        setSimilarityError(
          safeErrorMessage(
            similarityRequestError,
            "Similar questions could not be loaded.",
          ),
        );
      });

    try {
      await streamQuestionAnalysis(snapshot, {
        signal: aiController.signal,
        onEvent(event) {
          if (runIdRef.current !== runId || aiController.signal.aborted) return;

          if (event.type === "meta") {
            applyQuota(event.quota);
            setMaxAttempts(event.retryPolicy.maxAttempts);
            setStage("Scoring the question across five quality dimensions...");
          } else if (event.type === "attempt") {
            setAttempt(event.attempt);
            setMaxAttempts(event.maxAttempts);
            setRetry(undefined);
            setStage(
              event.attempt === 1
                ? "Scoring the question across five quality dimensions..."
                : `Retrying safely (attempt ${event.attempt} of ${event.maxAttempts})...`,
            );
          } else if (event.type === "retry") {
            setRetry(event);
            setPartial(undefined);
            setResult(undefined);
            setStage(
              `Attempt ${event.attempt} did not finish. Retrying once without using another quota...`,
            );
          } else if (event.type === "partial") {
            setPartial(event.data);
            if (event.data.tagSuggestions) {
              setStage("Preparing tags and safe local edits...");
            } else if (event.data.missingItems) {
              setStage("Finding details that may be missing...");
            }
          } else if (event.type === "complete") {
            terminalPhaseRef.current = "complete";
            setAttempt(event.attempt);
            setRetry(undefined);
            setResult(event.data);
            setPartial(event.data);
            setStatus("complete");
            setStage(
              event.attempt === 1
                ? "Analysis complete. You decide which suggestions to use."
                : "Analysis recovered on the second attempt. You decide which suggestions to use.",
            );
          }
        },
      });
    } catch (analysisError) {
      if (runIdRef.current !== runId) return;
      if (aiController.signal.aborted) {
        if (terminalPhaseRef.current === "streaming") {
          terminalPhaseRef.current = "cancelled";
          setStatus("cancelled");
        }
        return;
      }

      const normalizedError = analysisErrorState(analysisError);
      terminalPhaseRef.current = "error";
      setStatus("error");
      setError(normalizedError);
      if (normalizedError.quota) {
        applyQuota(normalizedError.quota);
      } else if (normalizedError.status === 429) {
        const resetAt = normalizedError.resetAt
          ? Date.parse(normalizedError.resetAt)
          : NaN;
        const fallbackReset = normalizedError.retryAfterSeconds
          ? Date.now() + normalizedError.retryAfterSeconds * 1_000
          : NaN;
        const blockedUntil = Number.isFinite(resetAt) ? resetAt : fallbackReset;
        if (Number.isFinite(blockedUntil)) {
          setQuotaBlockedUntil(blockedUntil);
          setQuotaScope(normalizedError.scope);
        }
      }
      setStage("The AI analysis did not finish. Your draft is still safe.");
    } finally {
      if (aiControllerRef.current === aiController) {
        aiControllerRef.current = null;
      }
    }
  }, [applyQuota, draft, quotaBlockedUntil]);

  const stopAnalysis = useCallback(() => {
    if (terminalPhaseRef.current !== "streaming") return;
    terminalPhaseRef.current = "cancelled";
    aiControllerRef.current?.abort();
    setStatus("cancelled");
    setStage(
      partial
        ? "Analysis stopped. Partial results are kept for reference."
        : "Analysis stopped before the first AI result arrived.",
    );
  }, [partial]);

  const isCurrentAnalysisDraft = useCallback(
    (candidate: QuestionWorkbenchDraft) =>
      analyzedFingerprintRef.current === fingerprintDraft(candidate),
    [],
  );

  const acknowledgeDraftMutation = useCallback(
    (
      previousDraft: QuestionWorkbenchDraft,
      nextDraft: QuestionWorkbenchDraft,
    ) => {
      if (!isCurrentAnalysisDraft(previousDraft)) return false;

      const nextFingerprint = fingerprintDraft(nextDraft);
      analyzedFingerprintRef.current = nextFingerprint;
      setAnalyzedFingerprint(nextFingerprint);
      return true;
    },
    [isCurrentAnalysisDraft],
  );

  useEffect(() => {
    void loadQuota();
    return () => quotaControllerRef.current?.abort();
  }, [loadQuota]);

  useEffect(() => {
    if (!quotaBlockedUntil) return;

    const timeout = window.setTimeout(
      () => {
        setQuotaBlockedUntil(undefined);
        setQuotaScope(undefined);
        setError((current) => (current?.status === 429 ? undefined : current));
        void loadQuota();
      },
      Math.max(0, quotaBlockedUntil - Date.now() + 50),
    );
    return () => window.clearTimeout(timeout);
  }, [loadQuota, quotaBlockedUntil]);

  useEffect(() => {
    if (
      terminalPhaseRef.current !== "streaming" ||
      !activeRunFingerprintRef.current ||
      activeRunFingerprintRef.current === currentFingerprint
    ) {
      return;
    }

    runIdRef.current += 1;
    terminalPhaseRef.current = "cancelled";
    aiControllerRef.current?.abort();
    similarityControllerRef.current?.abort();
    setStatus("cancelled");
    setStage(
      "Analysis stopped because the draft changed. Run it again when ready.",
    );
  }, [currentFingerprint]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      terminalPhaseRef.current = "cancelled";
      aiControllerRef.current?.abort();
      similarityControllerRef.current?.abort();
      quotaControllerRef.current?.abort();
    },
    [],
  );

  return {
    analyze,
    stopAnalysis,
    acknowledgeDraftMutation,
    isCurrentAnalysisDraft,
    canAnalyze: validation.success && !isQuotaBlocked,
    validationMessage: validation.success
      ? undefined
      : validation.error.issues[0]?.message,
    status,
    stage,
    attempt,
    maxAttempts,
    retry,
    partial,
    result,
    quota,
    quotaLoading,
    quotaScope,
    error,
    quotaBlockedUntil,
    isAnalysisStale,
    isSimilarityStale,
    similarityStatus,
    similarQuestions,
    similarityError,
  };
}
