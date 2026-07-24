"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ROUTES from "@/constants/routes";
import { useQuestionAnalysis } from "@/hooks/useQuestionAnalysis";
import {
  buildDraftEditMutation,
  buildDraftEditUndoMutation,
} from "@/lib/ai/draft-edit-operations.mjs";
import type {
  DraftEditField,
  DraftEditMutation,
  DraftEditTransaction,
  DraftMutationResult,
} from "@/lib/ai/draft-edit-types";
import {
  QUESTION_ANALYSIS_DIMENSION_KEYS,
  QUESTION_ANALYSIS_DIMENSION_LABELS,
  type DraftEdit,
  type QuestionAnalysisPartial,
  type QuestionWorkbenchDraft,
} from "@/lib/ai/question-analysis-schema";
import { useI18n } from "@/lib/i18n/client";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  MessageCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  SquareIcon,
  TagIcon,
  ThumbsUpIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AIDraftEditList from "./AIDraftEditList";

interface Props {
  title: string;
  content: string;
  tags: string[];
  questionId?: string;
  onAddTag: (
    tag: string,
    expectedDraft: QuestionWorkbenchDraft,
  ) => DraftMutationResult;
  onMutateDraft: (mutation: DraftEditMutation) => DraftMutationResult;
}

type DraftEditStacks = Record<DraftEditField, string[]>;

const createEmptyEditStacks = (): DraftEditStacks => ({
  title: [],
  content: [],
});

const scoreLabel = (score: number, t: (key: string) => string) => {
  if (score >= 85) return t("Excellent");
  if (score >= 70) return t("Strong");
  if (score >= 50) return t("Needs more detail");
  return t("Early draft");
};

const ScoreRing = ({ score }: { score: number }) => {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div
        role="meter"
        aria-label={t("Question quality score: {score} out of 100", { score })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="flex-center size-24 rounded-full p-2"
        style={{
          background: `conic-gradient(#ff7000 ${score * 3.6}deg, rgba(133, 142, 173, 0.2) 0deg)`,
        }}
      >
        <div className="background-light900_dark300 flex-center size-full flex-col rounded-full">
          <strong className="text-dark200_light900 text-2xl">{score}</strong>
          <span className="text-dark400_light700 text-xs">/ 100</span>
        </div>
      </div>
      <span className="small-semibold text-dark300_light700">
        {scoreLabel(score, t)}
      </span>
    </div>
  );
};

const DimensionList = ({ analysis }: { analysis: QuestionAnalysisPartial }) => {
  const { t } = useI18n();
  const dimensions = QUESTION_ANALYSIS_DIMENSION_KEYS.flatMap((key) => {
    const dimension = analysis.dimensions?.[key];
    return dimension ? [{ key, dimension }] : [];
  });

  if (dimensions.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {dimensions.map(({ key, dimension }) => {
        const value =
          typeof dimension.score === "number"
            ? Math.round(dimension.score)
            : undefined;

        return (
          <div
            key={key}
            className="background-light800_dark300 rounded-lg border border-light-700 p-3 dark:border-dark-400"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="small-semibold text-dark300_light700">
                {t(QUESTION_ANALYSIS_DIMENSION_LABELS[key])}
              </p>
              <span className="small-semibold text-primary-500">
                {value === undefined ? "..." : `${value}/20`}
              </span>
            </div>
            <div
              role="meter"
              aria-label={t(QUESTION_ANALYSIS_DIMENSION_LABELS[key])}
              aria-valuemin={0}
              aria-valuemax={20}
              aria-valuenow={value}
              className="mb-2 h-1.5 overflow-hidden rounded-full bg-light-700/70 dark:bg-dark-400"
            >
              <div
                className="h-full rounded-full bg-primary-500 transition-[width] motion-reduce:transition-none"
                style={{ width: `${((value ?? 0) / 20) * 100}%` }}
              />
            </div>
            <p className="small-regular text-dark400_light700">
              {dimension.feedback ?? t("Reviewing this dimension...")}
            </p>
          </div>
        );
      })}
    </div>
  );
};

const LoadingBlock = ({ label }: { label: string }) => (
  <div className="text-dark400_light700 flex items-center gap-2 py-3 text-sm">
    <Loader2Icon
      aria-hidden="true"
      className="size-4 animate-spin motion-reduce:animate-none"
    />
    <span>{label}</span>
  </div>
);

// 提问页面里的 AI 教练控制面板
// 这个组件主要负责：
/*
  获取当前问题草稿。
  调用 AI 分析。
  流式展示分析进度和结果。
  展示五个质量维度和总分。
  展示缺失信息建议。
  展示 AI 推荐的标题/正文修改。
  安全地应用和撤销修改。
  推荐标签并安全添加。
  检查可能重复的问题。
  防止用户修改草稿后，继续应用过期的 AI 建议。
 */
const AIQuestionWorkbench = ({
  title,
  content,
  tags,
  questionId,
  onAddTag,
  onMutateDraft,
}: Props) => {
  const { locale, t } = useI18n();
  const headingId = useId();
  const draft = useMemo(
    () => ({ title, content, tags, questionId }),
    [content, questionId, tags, title],
  );
  const {
    analyze,
    stopAnalysis,
    acknowledgeDraftMutation,
    isCurrentAnalysisDraft,
    canAnalyze,
    validationMessage,
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
  } = useQuestionAnalysis(draft);
  const currentDraftRef = useRef<QuestionWorkbenchDraft>(draft);
  const [appliedEdits, setAppliedEdits] = useState<
    Record<string, DraftEditTransaction>
  >({});
  const [editConflicts, setEditConflicts] = useState<
    Record<string, string | undefined>
  >({});
  const [editStacks, setEditStacks] = useState<DraftEditStacks>(
    createEmptyEditStacks,
  );
  const [tagMutationError, setTagMutationError] = useState<string>();
  const currentTags = new Set(tags.map((tag) => tag.trim().toLowerCase()));
  const canApplySuggestions = status === "complete" && !isAnalysisStale;
  const hasAIOutput = Boolean(partial || result);
  const appliedEditIds = useMemo(
    () => new Set(Object.keys(appliedEdits)),
    [appliedEdits],
  );
  const undoableEditIds = useMemo(() => {
    const ids = new Set<string>();
    for (const stack of Object.values(editStacks)) {
      const topEditId = stack[stack.length - 1];
      if (topEditId) ids.add(topEditId);
    }
    return ids;
  }, [editStacks]);
  const analyzeButtonLabel =
    status === "streaming"
      ? t("Analyzing...")
      : status === "idle"
        ? t("Analyze draft")
        : t("Analyze again");

  useLayoutEffect(() => {
    currentDraftRef.current = draft;
  }, [draft]);

  const setEditConflict = useCallback((editId: string, message?: string) => {
    setEditConflicts((current) => ({ ...current, [editId]: message }));
  }, []);

  const handleAnalyze = useCallback(() => {
    setAppliedEdits({});
    setEditConflicts({});
    setEditStacks(createEmptyEditStacks());
    setTagMutationError(undefined);
    void analyze();
  }, [analyze]);

  const handleApplyEdit = useCallback(
    (edit: DraftEdit) => {
      const previousDraft = currentDraftRef.current;
      if (!isCurrentAnalysisDraft(previousDraft)) {
        setEditConflict(
          edit.id,
          t(
            "The draft has changed since this analysis. Analyze it again before applying this suggestion.",
          ),
        );
        return;
      }

      const candidate = buildDraftEditMutation(previousDraft, edit) as Omit<
        DraftEditMutation,
        "expectedDraft"
      > | null;
      if (!candidate) {
        setEditConflict(
          edit.id,
          t(
            "The exact original text is no longer available, so no change was made.",
          ),
        );
        return;
      }
      const mutation: DraftEditMutation = {
        ...candidate,
        expectedDraft: previousDraft,
      };

      const outcome = onMutateDraft(mutation);
      if (!outcome.ok) {
        setEditConflict(edit.id, outcome.reason);
        return;
      }

      currentDraftRef.current = outcome.draft;
      acknowledgeDraftMutation(outcome.previousDraft, outcome.draft);
      setAppliedEdits((current) => ({
        ...current,
        [edit.id]: {
          field: mutation.field,
          beforeValue: mutation.expectedValue,
          afterValue: mutation.nextValue,
        },
      }));
      setEditStacks((current) => ({
        ...current,
        [mutation.field]: [
          ...current[mutation.field].filter((editId) => editId !== edit.id),
          edit.id,
        ],
      }));
      setEditConflict(edit.id);
    },
    [
      acknowledgeDraftMutation,
      isCurrentAnalysisDraft,
      onMutateDraft,
      setEditConflict,
      t,
    ],
  );

  const handleUndoEdit = useCallback(
    (edit: DraftEdit) => {
      const transaction = appliedEdits[edit.id];
      if (!transaction) return;

      const fieldStack = editStacks[transaction.field];
      if (fieldStack[fieldStack.length - 1] !== edit.id) {
        setEditConflict(
          edit.id,
          t(
            "Undo the later change to this field first. Your draft was not changed.",
          ),
        );
        return;
      }

      const previousDraft = currentDraftRef.current;
      const candidate = buildDraftEditUndoMutation(
        previousDraft,
        transaction,
      ) as Omit<DraftEditMutation, "expectedDraft"> | null;
      if (!candidate) {
        setEditConflict(
          edit.id,
          t(
            "Undo was blocked because this field changed afterward. Your newer text was kept.",
          ),
        );
        return;
      }
      const mutation: DraftEditMutation = {
        ...candidate,
        expectedDraft: previousDraft,
      };

      const outcome = onMutateDraft(mutation);
      if (!outcome.ok) {
        setEditConflict(edit.id, outcome.reason);
        return;
      }

      currentDraftRef.current = outcome.draft;
      acknowledgeDraftMutation(outcome.previousDraft, outcome.draft);
      setAppliedEdits((current) => {
        const next = { ...current };
        delete next[edit.id];
        return next;
      });
      setEditStacks((current) => {
        const stack = current[transaction.field];
        if (stack[stack.length - 1] !== edit.id) return current;
        return {
          ...current,
          [transaction.field]: stack.slice(0, -1),
        };
      });
      setEditConflict(edit.id);
    },
    [
      acknowledgeDraftMutation,
      appliedEdits,
      editStacks,
      onMutateDraft,
      setEditConflict,
      t,
    ],
  );

  const handleAddSuggestedTag = useCallback(
    (tag: string) => {
      const previousDraft = currentDraftRef.current;
      if (!isCurrentAnalysisDraft(previousDraft)) {
        setTagMutationError(
          t(
            "The draft changed after this analysis. Analyze it again before adding a suggested tag.",
          ),
        );
        return;
      }

      const outcome = onAddTag(tag, previousDraft);
      if (!outcome.ok) {
        setTagMutationError(outcome.reason);
        return;
      }

      currentDraftRef.current = outcome.draft;
      acknowledgeDraftMutation(outcome.previousDraft, outcome.draft);
      setTagMutationError(undefined);
    },
    [acknowledgeDraftMutation, isCurrentAnalysisDraft, onAddTag, t],
  );

  return (
    <section
      aria-labelledby={headingId}
      className="card-wrapper overflow-hidden rounded-xl border border-light-700 dark:border-dark-400"
    >
      <div className="border-b border-light-700 bg-linear-to-r from-primary-100/80 to-transparent p-5 dark:border-dark-400 dark:from-primary-500/10 sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="max-w-2xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <SparklesIcon
                aria-hidden="true"
                className="size-5 text-primary-500"
              />
              <h2
                id={headingId}
                className="base-semibold text-dark200_light900"
              >
                {t("AI Question Coach")}
              </h2>
              <Badge
                variant="outline"
                className="border-primary-500/30 text-primary-500"
              >
                {t("AI beta")}
              </Badge>
            </div>
            <p className="small-regular text-dark400_light700">
              {t(
                "Get a live quality review, missing-detail checklist, tag ideas, safe local text changes, and possible duplicate questions. Nothing is changed unless you choose it.",
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={!canAnalyze || status === "streaming"}
              className="primary-gradient min-h-11 px-4 text-white"
            >
              {status === "streaming" ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : status === "idle" ? (
                <SparklesIcon aria-hidden="true" />
              ) : (
                <RefreshCwIcon aria-hidden="true" />
              )}
              {analyzeButtonLabel}
            </Button>
            {status === "streaming" && (
              <Button
                type="button"
                variant="outline"
                onClick={stopAnalysis}
                className="min-h-11 px-4"
              >
                <SquareIcon aria-hidden="true" className="fill-current" />
                {t("Stop AI")}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p
            role="status"
            aria-live="polite"
            className="small-medium text-dark300_light700"
          >
            {t(stage)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {status === "streaming" && attempt > 0 && (
              <Badge variant="secondary">
                {t("Attempt {attempt}/{maxAttempts}", { attempt, maxAttempts })}
              </Badge>
            )}
            {retry && <Badge variant="outline">{t("Retry scheduled")}</Badge>}
            {quotaLoading && (
              <p className="small-regular text-dark400_light700">
                {t("Checking AI quota...")}
              </p>
            )}
          </div>
        </div>
        {quota && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-light-700 bg-light-900/60 px-3 py-2 dark:border-dark-400 dark:bg-dark-300/50">
              <p className="small-semibold text-dark300_light700">
                {t("Hourly quota: {remaining}/{limit} left", {
                  remaining: quota.hourRemaining,
                  limit: quota.hourLimit,
                })}
              </p>
              <p className="small-regular text-dark400_light700">
                {t("Resets at {time}", {
                  time: new Date(quota.hourResetAt).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}
              </p>
            </div>
            <div className="rounded-lg border border-light-700 bg-light-900/60 px-3 py-2 dark:border-dark-400 dark:bg-dark-300/50">
              <p className="small-semibold text-dark300_light700">
                {t("Daily quota: {remaining}/{limit} left", {
                  remaining: quota.dayRemaining,
                  limit: quota.dayLimit,
                })}
              </p>
              <p className="small-regular text-dark400_light700">
                {t("Resets at {time}", {
                  time: new Date(quota.dayResetAt).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}
              </p>
            </div>
          </div>
        )}
        {status !== "streaming" && validationMessage && (
          <p className="small-regular mt-2 text-dark400_light700">
            {t(validationMessage)}
          </p>
        )}
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {isAnalysisStale && (
          <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangleIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <p>
              {t(
                "The title, details, or tags changed after this run. Analyze again before applying its suggestions.",
              )}
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p>{t(error.message)}</p>
                {quotaBlockedUntil && (
                  <p className="mt-1 font-medium">
                    {t(
                      quotaScope === "day"
                        ? "Daily quota resets at"
                        : "Hourly quota resets at",
                    )}{" "}
                    {new Date(quotaBlockedUntil).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                )}
              </div>
              {error.retryable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || status === "streaming"}
                  className="self-start border-red-300 sm:self-auto dark:border-red-800"
                >
                  <RefreshCwIcon aria-hidden="true" />
                  {t("Retry")}
                </Button>
              )}
            </div>
          </div>
        )}

        {status === "streaming" && !hasAIOutput && (
          <LoadingBlock
            label={
              retry
                ? t("Waiting for the controlled retry...")
                : t("Waiting for the first AI analysis event...")
            }
          />
        )}

        {hasAIOutput && partial && (
          <div className="space-y-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {result && <ScoreRing score={result.qualityScore} />}
              <div className="min-w-0 flex-1">
                <h3 className="base-semibold text-dark200_light900">
                  {t("Quality review")}
                </h3>
                <p className="small-regular text-dark400_light700 mt-1">
                  {partial.summary ?? t("Building a structured review...")}
                </p>
              </div>
            </div>

            <DimensionList analysis={partial} />

            {partial.missingItems && partial.missingItems.length > 0 && (
              <div>
                <h3 className="base-semibold text-dark200_light900 mb-3">
                  {t("Details worth adding")}
                </h3>
                <div className="space-y-2">
                  {partial.missingItems.flatMap((item, index) =>
                    item?.label ? (
                      <div
                        key={`${item.id ?? "missing"}-${index}`}
                        className="background-light800_dark300 rounded-lg p-3"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="small-semibold text-dark300_light700">
                            {item.label}
                          </p>
                          {item.severity && (
                            <Badge
                              variant={
                                item.severity === "required"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {t(item.severity)}
                            </Badge>
                          )}
                        </div>
                        {item.reason && (
                          <p className="small-regular text-dark400_light700">
                            {item.reason}
                          </p>
                        )}
                        {item.suggestion && (
                          <p className="small-medium text-dark300_light700 mt-1">
                            {t("Try")}: {item.suggestion}
                          </p>
                        )}
                      </div>
                    ) : (
                      []
                    ),
                  )}
                </div>
              </div>
            )}

            {result && (
              <AIDraftEditList
                edits={result.draftEdits}
                canApply={canApplySuggestions}
                appliedEditIds={appliedEditIds}
                undoableEditIds={undoableEditIds}
                conflicts={editConflicts}
                onApply={handleApplyEdit}
                onUndo={handleUndoEdit}
              />
            )}

            {result && result.tagSuggestions.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <TagIcon
                    aria-hidden="true"
                    className="size-4 text-primary-500"
                  />
                  <h3 className="base-semibold text-dark200_light900">
                    {t("Suggested tags")}
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.tagSuggestions.map((suggestion) => {
                    const isAdded = currentTags.has(
                      suggestion.name.toLowerCase(),
                    );
                    const isDisabled =
                      isAdded || tags.length >= 3 || !canApplySuggestions;

                    return (
                      <div
                        key={suggestion.name}
                        className="background-light800_dark300 rounded-lg border border-light-700 p-3 dark:border-dark-400"
                      >
                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isDisabled}
                            aria-label={
                              isAdded
                                ? t("{name} is already added", {
                                    name: suggestion.name,
                                  })
                                : t("Add tag {name}", { name: suggestion.name })
                            }
                            onClick={() =>
                              handleAddSuggestedTag(suggestion.name)
                            }
                            className="min-h-11 min-w-0 max-w-full shrink justify-start whitespace-normal break-all text-left sm:w-auto sm:justify-center"
                          >
                            {isAdded ? (
                              <CheckCircle2Icon aria-hidden="true" />
                            ) : (
                              <PlusIcon aria-hidden="true" />
                            )}
                            {suggestion.name}
                          </Button>
                          <Badge variant="secondary" className="w-fit shrink-0">
                            {Math.round(suggestion.confidence * 100)}%
                          </Badge>
                        </div>
                        <p className="small-regular text-dark400_light700 mt-2">
                          {suggestion.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {tags.length >= 3 && (
                  <p className="small-regular text-dark400_light700 mt-2">
                    {t(
                      "Remove a tag first if you want to use another suggestion.",
                    )}
                  </p>
                )}
                {tagMutationError && (
                  <p
                    role="alert"
                    className="mt-2 text-sm text-amber-700 dark:text-amber-300"
                  >
                    {t(tagMutationError)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-light-700 pt-5 dark:border-dark-400">
          <div className="mb-3 flex items-center gap-2">
            <SearchIcon
              aria-hidden="true"
              className="size-4 text-primary-500"
            />
            <h3 className="base-semibold text-dark200_light900">
              {t("Possibly similar questions")}
            </h3>
          </div>

          {isSimilarityStale && (
            <div className="mb-3 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangleIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p>
                {t(
                  "This similarity check uses an earlier draft or tag set. Analyze again to refresh possible duplicates.",
                )}
              </p>
            </div>
          )}

          {!isSimilarityStale && similarityStatus === "idle" && (
            <p className="small-regular text-dark400_light700">
              {t("Similar questions are checked when you analyze the draft.")}
            </p>
          )}
          {!isSimilarityStale && similarityStatus === "loading" && (
            <LoadingBlock label={t("Checking existing questions locally...")} />
          )}
          {!isSimilarityStale &&
            similarityStatus === "error" &&
            similarityError && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-300"
              >
                {t(similarityError)}
              </p>
            )}
          {!isSimilarityStale &&
            similarityStatus === "complete" &&
            similarQuestions.length === 0 && (
              <p className="small-regular text-dark400_light700">
                {t(
                  "No strong match was found. This does not block you from posting.",
                )}
              </p>
            )}
          {!isSimilarityStale && similarQuestions.length > 0 && (
            <div className="space-y-3">
              {similarQuestions.map((question) => (
                <article
                  key={question.id}
                  className="background-light800_dark300 rounded-lg border border-light-700 p-4 dark:border-dark-400"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div className="min-w-0">
                      <Link
                        href={ROUTES.QUESTION(question.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="small-semibold text-dark200_light900 hover:text-primary-500"
                      >
                        {question.title}
                        <span className="sr-only">
                          {" "}
                          {t("(opens in a new tab)")}
                        </span>
                        <ExternalLinkIcon
                          aria-hidden="true"
                          className="ml-1 inline size-3.5"
                        />
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {question.reasons.map((reason) => (
                          <Badge key={reason.type} variant="secondary">
                            {t(reason.label)}
                            {reason.values.length > 0
                              ? `: ${reason.values.join(", ")}`
                              : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="h-fit shrink-0 border-primary-500/30 text-primary-500"
                    >
                      {question.score}% {t("match")}
                    </Badge>
                  </div>
                  <div className="text-dark400_light700 mt-3 flex flex-wrap gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <MessageCircleIcon
                        aria-hidden="true"
                        className="size-3.5"
                      />
                      {question.answers} {t("answers")}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUpIcon aria-hidden="true" className="size-3.5" />
                      {question.upvotes} {t("votes")}
                    </span>
                    {question.hasAcceptedAnswer && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2Icon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        {t("Solved")}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AIQuestionWorkbench;
