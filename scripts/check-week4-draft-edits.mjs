import assert from "node:assert/strict";
import {
  buildDraftEditMutation,
  buildDraftEditUndoMutation,
  normalizeDraftEditProposals,
} from "../lib/ai/draft-edit-operations.mjs";

const ids = () => {
  let nextId = 0;
  return () => `edit-${++nextId}`;
};

const proposal = (values) => ({
  category: "clarity",
  label: "Improve this section",
  reason: "Make the question easier to understand.",
  ...values,
});

const baseDraft = {
  title: "React effect runs with stale state",
  content:
    "Environment: React 19\n\nThe value stays at zero.\n\nExpected: latest value.",
};

const normalized = normalizeDraftEditProposals(
  [
    proposal({
      operation: "replace",
      target: "title",
      before: baseDraft.title,
      after: "Why does my React effect read stale state?",
      reason: "Make the symptom explicit.",
    }),
    proposal({
      target: "content",
      before: "The value stays at zero.",
      after: "The effect logs the initial value even after state changes.",
    }),
  ],
  baseDraft,
  ids(),
);
assert.equal(normalized.length, 2);
assert.deepEqual(
  normalized.map(({ id, target }) => ({ id, target })),
  [
    { id: "edit-1", target: "title" },
    { id: "edit-2", target: "content" },
  ],
);

const titleMutation = buildDraftEditMutation(baseDraft, normalized[0]);
assert.deepEqual(titleMutation, {
  field: "title",
  expectedValue: baseDraft.title,
  nextValue: "Why does my React effect read stale state?",
});
assert.equal(
  buildDraftEditMutation(
    { ...baseDraft, title: `${baseDraft.title}!` },
    normalized[0],
  ),
  null,
  "A title replacement must use the exact analyzed title",
);

const manuallyExtendedDraft = {
  ...baseDraft,
  content: `Manual note.\n\n${baseDraft.content}\n\nBrowser: Chrome`,
};
const contentMutation = buildDraftEditMutation(
  manuallyExtendedDraft,
  normalized[1],
);
assert.ok(contentMutation);
assert.equal(contentMutation.expectedValue, manuallyExtendedDraft.content);
assert.equal(
  contentMutation.nextValue,
  "Manual note.\n\nEnvironment: React 19\n\nThe effect logs the initial value even after state changes.\n\nExpected: latest value.\n\nBrowser: Chrome",
  "Manual changes outside the patch must survive apply",
);

const transaction = {
  field: contentMutation.field,
  beforeValue: contentMutation.expectedValue,
  afterValue: contentMutation.nextValue,
};
assert.deepEqual(
  buildDraftEditUndoMutation(
    { ...manuallyExtendedDraft, content: contentMutation.nextValue },
    transaction,
  ),
  {
    field: "content",
    expectedValue: contentMutation.nextValue,
    nextValue: manuallyExtendedDraft.content,
  },
);
assert.equal(
  buildDraftEditUndoMutation(
    {
      ...manuallyExtendedDraft,
      content: `${contentMutation.nextValue}\nNew work`,
    },
    transaction,
  ),
  null,
  "Undo must not overwrite work added after apply",
);

const repeatedDraft = {
  title: "Repeated anchor",
  content: "same paragraph\n\nsame paragraph",
};
assert.deepEqual(
  normalizeDraftEditProposals(
    [
      proposal({
        target: "content",
        before: "same paragraph",
        after: "different paragraph",
      }),
    ],
    repeatedDraft,
    ids(),
  ),
  [],
  "A repeated content anchor is ambiguous",
);
assert.equal(
  buildDraftEditMutation(repeatedDraft, {
    target: "content",
    before: "same paragraph",
    after: "different paragraph",
  }),
  null,
);

const overlapDraft = {
  title: "Overlapping proposals",
  content: "alpha beta gamma delta",
};
const overlapResult = normalizeDraftEditProposals(
  [
    proposal({
      target: "content",
      before: "beta gamma",
      after: "B G",
    }),
    proposal({
      target: "content",
      before: "gamma delta",
      after: "G D",
    }),
    proposal({
      target: "content",
      before: "beta gamma",
      after: "B G",
    }),
    proposal({
      target: "content",
      before: "alpha",
      after: "alpha",
    }),
    proposal({
      operation: "append",
      target: "content",
      before: "alpha",
      after: "ALPHA",
    }),
  ],
  overlapDraft,
  ids(),
);
assert.equal(
  overlapResult.length,
  1,
  "Overlapping and duplicate edits are rejected",
);
assert.equal(overlapResult[0].before, "beta gamma");

const fencedDraft = {
  title: "Do not rewrite code",
  content: "Before code.\n\n```js\nconst value = 1;\n```\n\nAfter code.",
};
const fencedResult = normalizeDraftEditProposals(
  [
    proposal({
      target: "content",
      before: "const value = 1;",
      after: "const value = 2;",
    }),
    proposal({
      target: "content",
      before: "After code.",
      after: "```txt\nAfter code.\n```",
    }),
    proposal({
      target: "content",
      before: "Before code.",
      after: "Context before code.",
    }),
  ],
  fencedDraft,
  ids(),
);
assert.equal(fencedResult.length, 1);
assert.equal(fencedResult[0].before, "Before code.");

const titleAtLimit = "T".repeat(100);
const contentAtLimit = `${"C".repeat(19_999)}X`;
assert.deepEqual(
  normalizeDraftEditProposals(
    [
      proposal({
        target: "title",
        before: titleAtLimit,
        after: `${titleAtLimit}!`,
      }),
      proposal({
        target: "content",
        before: "X",
        after: "XX",
      }),
    ],
    { title: titleAtLimit, content: contentAtLimit },
    ids(),
  ),
  [],
  "Edits that exceed final field limits are rejected",
);

const rawBefore = "Line one\r\n\r\nEmoji: 🧪  keeps  spaces";
const rawAfter = "Line one\r\n\r\nEmoji: 🧪  preserves  spaces";
const rawDraft = {
  title: "Preserve exact source text",
  content: `Header\r\n${rawBefore}\r\nFooter`,
};
const rawEdit = normalizeDraftEditProposals(
  [
    proposal({
      target: "content",
      before: rawBefore,
      after: rawAfter,
    }),
  ],
  rawDraft,
  ids(),
)[0];
assert.equal(rawEdit.before, rawBefore);
assert.equal(rawEdit.after, rawAfter);
const rawMutation = buildDraftEditMutation(rawDraft, rawEdit);
assert.ok(rawMutation);
assert.equal(
  rawMutation.nextValue,
  `Header\r\n${rawAfter}\r\nFooter`,
  "CRLF, emoji, and repeated spaces must survive exactly",
);

const capped = normalizeDraftEditProposals(
  ["one", "two", "three", "four", "five"].map((value) =>
    proposal({
      target: "content",
      before: value,
      after: value.toUpperCase(),
    }),
  ),
  {
    title: "Cap edit count",
    content: "one two three four five",
  },
  ids(),
);
assert.equal(capped.length, 4, "At most four edits may be normalized");

process.stdout.write("Week 4 draft-edit checks passed.\n");
