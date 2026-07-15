const MAX_TITLE_LENGTH = 100;
const MAX_CONTENT_LENGTH = 20_000;
const MAX_NORMALIZED_EDITS = 4;

/** @typedef {"title" | "content"} DraftEditField */

/**
 * The draft fields that AI edits are allowed to change.
 * Tags and identifiers deliberately stay outside this type.
 *
 * @typedef {object} EditableQuestionDraft
 * @property {string} title
 * @property {string} content
 */

/**
 * A replace proposal produced from an untrusted AI response.
 * `before` and `after` are intentionally kept byte-for-byte as JavaScript
 * strings; normalization must not trim or change line endings.
 *
 * @typedef {object} DraftEditProposal
 * The current wire format represents replace implicitly. If an `operation`
 * property is supplied, only the literal `replace` is accepted.
 *
 * @property {DraftEditField} target
 * @property {"replace" | undefined} [operation]
 * @property {string} before
 * @property {string} after
 * @property {"clarity" | "context" | "reproduction" | "expected-vs-actual" | "formatting"} category
 * @property {string} label
 * @property {string} reason
 */

/**
 * @typedef {Omit<DraftEditProposal, "operation"> & { id: string }} NormalizedDraftEdit
 */

/**
 * A full-field compare-and-swap mutation. The caller must compare its current
 * form value with `expectedValue` immediately before committing `nextValue`.
 *
 * @typedef {object} DraftEditMutation
 * @property {DraftEditField} field
 * @property {string} expectedValue
 * @property {string} nextValue
 */

/**
 * The durable information required to undo an applied mutation safely.
 *
 * @typedef {object} DraftEditTransaction
 * @property {DraftEditField} field
 * @property {string} beforeValue
 * @property {string} afterValue
 */

/**
 * @param {unknown} value
 * @returns {value is EditableQuestionDraft}
 */
function isEditableDraft(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.title === "string" &&
    typeof value.content === "string"
  );
}

/**
 * @param {unknown} value
 * @returns {value is DraftEditField}
 */
function isDraftEditField(value) {
  return value === "title" || value === "content";
}

/**
 * @param {unknown} value
 */
function isDraftEditCategory(value) {
  return (
    value === "clarity" ||
    value === "context" ||
    value === "reproduction" ||
    value === "expected-vs-actual" ||
    value === "formatting"
  );
}

/**
 * Finds the second occurrence as well as overlapping occurrences. A unique
 * anchor is required because silently choosing the first match could modify
 * the wrong paragraph.
 *
 * @param {string} value
 * @param {string} needle
 * @returns {number | null}
 */
function uniqueIndexOf(value, needle) {
  if (needle.length === 0) return null;

  const firstIndex = value.indexOf(needle);
  if (firstIndex < 0) return null;
  return value.indexOf(needle, firstIndex + 1) < 0 ? firstIndex : null;
}

/**
 * @typedef {{ start: number; end: number }} TextRange
 */

/**
 * Locates fenced Markdown code blocks while retaining offsets in the original
 * string, including CRLF input. Both backtick and tilde fences are protected.
 *
 * @param {string} markdown
 * @returns {TextRange[]}
 */
function fencedCodeRanges(markdown) {
  /** @type {TextRange[]} */
  const ranges = [];
  /** @type {{ marker: "`" | "~"; length: number; start: number } | null} */
  let openFence = null;
  const lines = markdown.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/gu);

  for (const match of lines) {
    const rawLine = match[0];
    if (rawLine.length === 0) continue;

    const line = rawLine.replace(/(?:\r\n|\n|\r)$/u, "");
    const fenceMatch = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (!fenceMatch) continue;

    const token = fenceMatch[1];
    const marker = /** @type {"`" | "~"} */ (token[0]);
    const suffix = fenceMatch[2];

    if (!openFence) {
      openFence = { marker, length: token.length, start: match.index };
      continue;
    }

    if (
      marker === openFence.marker &&
      token.length >= openFence.length &&
      suffix.trim().length === 0
    ) {
      ranges.push({
        start: openFence.start,
        end: match.index + rawLine.length,
      });
      openFence = null;
    }
  }

  if (openFence) {
    ranges.push({ start: openFence.start, end: markdown.length });
  }

  return ranges;
}

/**
 * @param {TextRange} left
 * @param {TextRange} right
 */
function rangesOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
}

/**
 * @param {string} value
 */
function containsFenceMarker(value) {
  return /`{3,}|~{3,}/u.test(value);
}

/**
 * Converts untrusted AI replace proposals into a small, deterministic set of
 * non-overlapping edits against the analyzed snapshot. Invalid proposals are
 * ignored rather than allowed to reach the form mutation layer.
 *
 * @param {readonly DraftEditProposal[] | unknown} proposals
 * @param {EditableQuestionDraft | unknown} draft
 * @param {(proposal: DraftEditProposal, index: number) => string} idFactory
 * @returns {NormalizedDraftEdit[]}
 */
export function normalizeDraftEditProposals(proposals, draft, idFactory) {
  if (!Array.isArray(proposals) || !isEditableDraft(draft)) return [];
  if (typeof idFactory !== "function") {
    throw new TypeError("idFactory must be a function.");
  }

  const codeRanges = fencedCodeRanges(draft.content);
  /** @type {TextRange[]} */
  const acceptedTitleRanges = [];
  /** @type {TextRange[]} */
  const acceptedContentRanges = [];
  const seenEdits = new Set();
  const seenIds = new Set();
  /** @type {NormalizedDraftEdit[]} */
  const normalized = [];
  let prospectiveTitleLength = draft.title.length;
  let prospectiveContentLength = draft.content.length;

  for (const rawProposal of proposals) {
    if (normalized.length >= MAX_NORMALIZED_EDITS) break;
    if (typeof rawProposal !== "object" || rawProposal === null) continue;

    const proposal = /** @type {Partial<DraftEditProposal>} */ (rawProposal);
    if (
      (proposal.operation !== undefined && proposal.operation !== "replace") ||
      !isDraftEditField(proposal.target) ||
      typeof proposal.before !== "string" ||
      typeof proposal.after !== "string" ||
      !isDraftEditCategory(proposal.category) ||
      typeof proposal.label !== "string" ||
      typeof proposal.reason !== "string" ||
      proposal.before.length === 0 ||
      proposal.before === proposal.after ||
      containsFenceMarker(proposal.before) ||
      containsFenceMarker(proposal.after)
    ) {
      continue;
    }

    const source = draft[proposal.target];
    let start;
    if (proposal.target === "title") {
      if (proposal.before !== source) continue;
      start = 0;
    } else {
      const uniqueStart = uniqueIndexOf(source, proposal.before);
      if (uniqueStart === null) continue;
      start = uniqueStart;
    }

    const range = { start, end: start + proposal.before.length };
    const acceptedRanges =
      proposal.target === "title" ? acceptedTitleRanges : acceptedContentRanges;
    if (acceptedRanges.some((accepted) => rangesOverlap(accepted, range))) {
      continue;
    }
    if (
      proposal.target === "content" &&
      codeRanges.some((codeRange) => rangesOverlap(codeRange, range))
    ) {
      continue;
    }

    const dedupeKey = JSON.stringify([
      proposal.target,
      proposal.before,
      proposal.after,
    ]);
    if (seenEdits.has(dedupeKey)) continue;

    const nextLength =
      (proposal.target === "title"
        ? prospectiveTitleLength
        : prospectiveContentLength) +
      proposal.after.length -
      proposal.before.length;
    if (
      (proposal.target === "title" && nextLength > MAX_TITLE_LENGTH) ||
      (proposal.target === "content" && nextLength > MAX_CONTENT_LENGTH)
    ) {
      continue;
    }

    const completeProposal =
      /** @type {Omit<DraftEditProposal, "operation">} */ ({
        target: proposal.target,
        before: proposal.before,
        after: proposal.after,
        category: proposal.category,
        label: proposal.label,
        reason: proposal.reason,
      });
    const id = idFactory(completeProposal, normalized.length);
    if (typeof id !== "string" || id.length === 0 || seenIds.has(id)) continue;

    seenEdits.add(dedupeKey);
    seenIds.add(id);
    acceptedRanges.push(range);
    if (proposal.target === "title") prospectiveTitleLength = nextLength;
    else prospectiveContentLength = nextLength;
    normalized.push({ id, ...completeProposal });
  }

  return normalized;
}

/**
 * Builds a compare-and-swap mutation without modifying the supplied draft.
 * Manual edits outside a content patch are retained; the target itself still
 * has to occur exactly once in the current field value.
 *
 * @param {EditableQuestionDraft | unknown} draft
 * @param {NormalizedDraftEdit | DraftEditProposal | unknown} edit
 * @returns {DraftEditMutation | null}
 */
export function buildDraftEditMutation(draft, edit) {
  if (!isEditableDraft(draft) || typeof edit !== "object" || edit === null) {
    return null;
  }

  const candidate = /** @type {Partial<DraftEditProposal>} */ (edit);
  if (
    (candidate.operation !== undefined && candidate.operation !== "replace") ||
    !isDraftEditField(candidate.target) ||
    typeof candidate.before !== "string" ||
    typeof candidate.after !== "string" ||
    candidate.before.length === 0 ||
    candidate.before === candidate.after
  ) {
    return null;
  }

  const currentValue = draft[candidate.target];
  if (candidate.target === "title") {
    if (
      currentValue !== candidate.before ||
      candidate.after.length > MAX_TITLE_LENGTH
    ) {
      return null;
    }

    return {
      field: "title",
      expectedValue: currentValue,
      nextValue: candidate.after,
    };
  }

  const start = uniqueIndexOf(currentValue, candidate.before);
  if (start === null) return null;
  const targetRange = { start, end: start + candidate.before.length };
  if (
    containsFenceMarker(candidate.after) ||
    fencedCodeRanges(currentValue).some((range) =>
      rangesOverlap(range, targetRange),
    )
  ) {
    return null;
  }

  const nextValue =
    currentValue.slice(0, start) +
    candidate.after +
    currentValue.slice(targetRange.end);
  if (nextValue.length > MAX_CONTENT_LENGTH) return null;

  return {
    field: "content",
    expectedValue: currentValue,
    nextValue,
  };
}

/**
 * Builds the inverse compare-and-swap mutation. Undo is deliberately strict:
 * any change made after the edit, even outside the replaced range, prevents a
 * full-field rollback from overwriting the user's newer work.
 *
 * @param {EditableQuestionDraft | unknown} draft
 * @param {DraftEditTransaction | unknown} transaction
 * @returns {DraftEditMutation | null}
 */
export function buildDraftEditUndoMutation(draft, transaction) {
  if (
    !isEditableDraft(draft) ||
    typeof transaction !== "object" ||
    transaction === null
  ) {
    return null;
  }

  const candidate = /** @type {Partial<DraftEditTransaction>} */ (transaction);
  if (
    !isDraftEditField(candidate.field) ||
    typeof candidate.beforeValue !== "string" ||
    typeof candidate.afterValue !== "string" ||
    draft[candidate.field] !== candidate.afterValue
  ) {
    return null;
  }

  return {
    field: candidate.field,
    expectedValue: candidate.afterValue,
    nextValue: candidate.beforeValue,
  };
}
