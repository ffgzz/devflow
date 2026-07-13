"use client";

import {
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

const fingerprintDraft = (draft: QuestionWorkbenchDraft) =>
  JSON.stringify([
    draft.title.trim(),
    draft.content.trim(),
    draft.tags
      .map((tag) => tag.normalize("NFKC").trim().toLowerCase())
      .sort(),
    draft.questionId ?? null,
  ]);

const safeErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export interface QuestionAnalysisErrorState {
  message: string;
  status?: number;
  retryAfterSeconds?: number;
  retryable: boolean;
}

const analysisErrorState = (error: unknown): QuestionAnalysisErrorState => {
  if (error instanceof QuestionWorkbenchRequestError) {
    return {
      message: error.message,
      status: error.status,
      retryAfterSeconds: error.retryAfterSeconds,
      retryable: error.status >= 429,
    };
  }

  if (error instanceof QuestionAnalysisStreamError) {
    return {
      message: error.message,
      retryable: error.retryable,
    };
  }

  return {
    message: safeErrorMessage(error, "The analysis could not be completed."),
    retryable: true,
  };
};

export function useQuestionAnalysis(draft: QuestionWorkbenchDraft) {
  const [status, setStatus] = useState<QuestionAnalysisStatus>("idle");
  const [stage, setStage] = useState(
    "Add a clear title and a few details, then analyze your draft.",
  );
  const [partial, setPartial] = useState<QuestionAnalysisPartial>();
  const [result, setResult] = useState<QuestionAnalysis>();
  const [quota, setQuota] = useState<AIQuota>();
  const [error, setError] = useState<QuestionAnalysisErrorState>();
  const [quotaBlockedUntil, setQuotaBlockedUntil] = useState<number>();
  const [similarityStatus, setSimilarityStatus] =
    useState<SimilarityStatus>("idle");
  const [similarQuestions, setSimilarQuestions] = useState<
    SimilarQuestion[]
  >([]);
  const [similarityError, setSimilarityError] = useState<string>();
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState<string>();
  const [similarityFingerprint, setSimilarityFingerprint] = useState<string>();
  const runIdRef = useRef(0);
  const aiControllerRef = useRef<AbortController | null>(null);
  const similarityControllerRef = useRef<AbortController | null>(null);

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
  const isQuotaBlocked = quotaBlockedUntil !== undefined;

  const analyze = useCallback(async () => {
    const parsed = QuestionWorkbenchDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Add more detail first.";
      setError({ message, retryable: false });
      setStatus("error");
      setStage("The draft is not ready to analyze yet.");
      return;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;
    aiControllerRef.current?.abort();
    similarityControllerRef.current?.abort();

    const aiController = new AbortController();
    const similarityController = new AbortController();
    aiControllerRef.current = aiController;
    similarityControllerRef.current = similarityController;

    const snapshot = parsed.data;
    const snapshotFingerprint = fingerprintDraft(snapshot);
    setAnalyzedFingerprint(snapshotFingerprint);
    setSimilarityFingerprint(snapshotFingerprint);
    setStatus("streaming");
    setStage("Reading the question draft...");
    setPartial(undefined);
    setResult(undefined);
    setQuota(undefined);
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
        if (
          runIdRef.current !== runId ||
          similarityController.signal.aborted
        ) {
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
            setQuota(event.quota);
            setStage("Scoring the question across five quality dimensions...");
          } else if (event.type === "partial") {
            setPartial(event.data);
            if (event.data.tagSuggestions) {
              setStage("Preparing tag suggestions...");
            } else if (event.data.missingItems) {
              setStage("Finding details that may be missing...");
            }
          } else if (event.type === "complete") {
            setResult(event.data);
            setPartial(event.data);
            setStatus("complete");
            setStage("Analysis complete. You decide which suggestions to use.");
          }
        },
      });
    } catch (analysisError) {
      if (runIdRef.current !== runId) return;
      if (aiController.signal.aborted) {
        setStatus("cancelled");
        return;
      }

      const normalizedError = analysisErrorState(analysisError);
      setStatus("error");
      setError(normalizedError);
      if (
        normalizedError.status === 429 &&
        normalizedError.retryAfterSeconds
      ) {
        setQuotaBlockedUntil(
          Date.now() + normalizedError.retryAfterSeconds * 1_000,
        );
      }
      setStage("The AI analysis did not finish. Your draft is still safe.");
    }
  }, [draft]);

  const stopAnalysis = useCallback(() => {
    if (status !== "streaming") return;
    aiControllerRef.current?.abort();
    setStatus("cancelled");
    setStage(
      partial
        ? "Analysis stopped. Partial results are kept for reference."
        : "Analysis stopped before the first AI result arrived.",
    );
  }, [partial, status]);

  const acknowledgeSuggestedTag = useCallback(
    (tag: string) => {
      setAnalyzedFingerprint(
        fingerprintDraft({ ...draft, tags: [...draft.tags, tag] }),
      );
    },
    [draft],
  );

  useEffect(() => {
    if (!quotaBlockedUntil) return;

    const timeout = window.setTimeout(
      () => {
        setQuotaBlockedUntil(undefined);
        setError((current) =>
          current?.status === 429 ? undefined : current,
        );
      },
      Math.max(0, quotaBlockedUntil - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [quotaBlockedUntil]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      aiControllerRef.current?.abort();
      similarityControllerRef.current?.abort();
    },
    [],
  );

  return {
    analyze,
    stopAnalysis,
    acknowledgeSuggestedTag,
    canAnalyze: validation.success && !isQuotaBlocked,
    validationMessage: validation.success
      ? undefined
      : validation.error.issues[0]?.message,
    status,
    stage,
    partial,
    result,
    quota,
    error,
    quotaBlockedUntil,
    isAnalysisStale,
    isSimilarityStale,
    similarityStatus,
    similarQuestions,
    similarityError,
  };
}
