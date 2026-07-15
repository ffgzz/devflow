import type { QuestionWorkbenchDraft } from "./question-analysis-schema";

export type DraftEditField = "title" | "content";

/** A full-field compare-and-swap request sent to the form owner. */
export interface DraftEditMutation {
  field: DraftEditField;
  expectedValue: string;
  nextValue: string;
  /**
   * The complete draft snapshot that the suggestion was built against.
   * The form owner compares this at commit time so a newer change in another
   * field cannot be accidentally folded into an older AI analysis.
   */
  expectedDraft: QuestionWorkbenchDraft;
}

/** The snapshot needed to undo an applied edit without losing newer typing. */
export interface DraftEditTransaction {
  field: DraftEditField;
  beforeValue: string;
  afterValue: string;
}

export type DraftMutationResult =
  | {
      ok: true;
      previousDraft: QuestionWorkbenchDraft;
      draft: QuestionWorkbenchDraft;
    }
  | { ok: false; reason: string };
