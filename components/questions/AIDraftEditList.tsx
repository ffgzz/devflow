"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DraftEdit } from "@/lib/ai/question-analysis-schema";
import {
  AlertTriangleIcon,
  CheckIcon,
  SparklesIcon,
  Undo2Icon,
} from "lucide-react";

interface Props {
  edits: DraftEdit[];
  canApply: boolean;
  appliedEditIds: ReadonlySet<string>;
  undoableEditIds: ReadonlySet<string>;
  conflicts: Readonly<Record<string, string | undefined>>;
  onApply: (edit: DraftEdit) => void;
  onUndo: (edit: DraftEdit) => void;
}

const categoryLabels: Record<DraftEdit["category"], string> = {
  clarity: "Clarity",
  context: "Context",
  reproduction: "Reproduction",
  "expected-vs-actual": "Expected vs. actual",
  formatting: "Formatting",
};

const AIDraftEditList = ({
  edits,
  canApply,
  appliedEditIds,
  undoableEditIds,
  conflicts,
  onApply,
  onUndo,
}: Props) => {
  if (edits.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <SparklesIcon aria-hidden="true" className="size-4 text-primary-500" />
        <h3 className="base-semibold text-dark200_light900">
          Suggested draft changes
        </h3>
      </div>

      <div className="space-y-3">
        {edits.map((edit) => {
          const isApplied = appliedEditIds.has(edit.id);
          const canUndo = undoableEditIds.has(edit.id);
          const conflict = conflicts[edit.id];
          const headingId = `draft-edit-${edit.id}`;
          const undoHintId = `${headingId}-undo-hint`;
          const targetLabel =
            edit.target === "title" ? "Title" : "Question body";

          return (
            <article
              key={edit.id}
              aria-labelledby={headingId}
              className="background-light800_dark300 min-w-0 rounded-lg border border-light-700 p-4 dark:border-dark-400"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{targetLabel}</Badge>
                    <Badge variant="secondary">
                      {categoryLabels[edit.category]}
                    </Badge>
                    {isApplied && (
                      <Badge className="bg-green-600 text-white dark:bg-green-700">
                        <CheckIcon
                          aria-hidden="true"
                          data-icon="inline-start"
                        />
                        Applied
                      </Badge>
                    )}
                  </div>
                  <h4
                    id={headingId}
                    className="small-semibold text-dark200_light900"
                  >
                    {edit.label}
                  </h4>
                  <p className="small-regular text-dark400_light700 mt-1">
                    {edit.reason}
                  </p>
                </div>

                {isApplied ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canUndo}
                    onClick={() => onUndo(edit)}
                    aria-label={`Undo change: ${edit.label}`}
                    aria-describedby={!canUndo ? undoHintId : undefined}
                    className="self-start"
                  >
                    <Undo2Icon aria-hidden="true" />
                    Undo
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canApply}
                    onClick={() => onApply(edit)}
                    aria-label={`Apply change: ${edit.label}`}
                    className="self-start"
                  >
                    <SparklesIcon aria-hidden="true" />
                    Apply change
                  </Button>
                )}
              </div>

              {isApplied && !canUndo && (
                <p
                  id={undoHintId}
                  className="small-medium mt-3 text-amber-700 dark:text-amber-300"
                >
                  Undo the later change to this field first.
                </p>
              )}

              <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
                <div className="min-w-0 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-red-700 uppercase dark:text-red-300">
                    Before
                  </p>
                  <del className="block whitespace-pre-wrap break-words font-mono text-sm text-red-950 dark:text-red-100">
                    {edit.before}
                  </del>
                </div>

                <div className="min-w-0 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-green-700 uppercase dark:text-green-300">
                    After
                  </p>
                  <ins className="block whitespace-pre-wrap break-words font-mono text-sm text-green-950 no-underline dark:text-green-100">
                    {edit.after}
                  </ins>
                </div>
              </div>

              {conflict && (
                <div
                  role="alert"
                  className="mt-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <AlertTriangleIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <p>{conflict}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default AIDraftEditList;
