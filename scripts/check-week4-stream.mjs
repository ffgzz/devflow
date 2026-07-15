import assert from "node:assert/strict";
import { createQuestionStreamProtocolValidator } from "../lib/ai/question-stream-protocol.mjs";

const REQUEST_ID = "36b0d73e-9cf8-4f6c-bc64-c9a870ea2c64";

const meta = (maxAttempts = 2) => ({
  v: 2,
  type: "meta",
  requestId: REQUEST_ID,
  retryPolicy: {
    maxAttempts,
    attemptsShareQuota: true,
  },
});

const attempt = (value, maxAttempts = 2) => ({
  v: 2,
  type: "attempt",
  requestId: REQUEST_ID,
  attempt: value,
  maxAttempts,
});

const partial = (attemptNumber, seq) => ({
  v: 2,
  type: "partial",
  requestId: REQUEST_ID,
  attempt: attemptNumber,
  seq,
  data: {},
});

const retry = (attemptNumber, nextAttempt) => ({
  v: 2,
  type: "retry",
  requestId: REQUEST_ID,
  attempt: attemptNumber,
  nextAttempt,
});

const complete = (attemptNumber) => ({
  v: 2,
  type: "complete",
  requestId: REQUEST_ID,
  attempt: attemptNumber,
  data: {},
});

const terminalError = (attemptNumber) => ({
  v: 2,
  type: "error",
  requestId: REQUEST_ID,
  attempt: attemptNumber,
  error: { code: "AI_TIMEOUT", message: "Timed out.", retryable: true },
});

const validateAll = (events) => {
  const validator = createQuestionStreamProtocolValidator();
  for (const event of events) assert.equal(validator.validate(event), null);
  return validator;
};

const expectInvalid = (events, expectedError) => {
  const validator = createQuestionStreamProtocolValidator();
  let actualError = null;
  for (const event of events) {
    actualError = validator.validate(event);
    if (actualError !== null) break;
  }
  assert.equal(actualError, expectedError);
};

const singleAttempt = validateAll([
  meta(),
  attempt(1),
  partial(1, 1),
  partial(1, 3),
  complete(1),
]);
assert.equal(singleAttempt.isComplete(), true);

const retrySuccess = validateAll([
  meta(),
  attempt(1),
  partial(1, 2),
  retry(1, 2),
  attempt(2),
  partial(2, 1),
  complete(2),
]);
assert.equal(retrySuccess.isComplete(), true);

const deadlineDuringRetry = validateAll([
  meta(),
  attempt(1),
  retry(1, 2),
  attempt(2),
  terminalError(2),
]);
assert.equal(deadlineDuringRetry.isComplete(), false);

const errorTerminal = validateAll([meta(), attempt(1), terminalError(1)]);
assert.equal(errorTerminal.isComplete(), false);

expectInvalid(
  [attempt(1)],
  "The analysis stream must start with one metadata event.",
);
expectInvalid(
  [meta(), meta()],
  "The analysis stream repeated its metadata event.",
);
expectInvalid(
  [
    {
      ...meta(),
      retryPolicy: { maxAttempts: 0, attemptsShareQuota: true },
    },
  ],
  "The analysis stream metadata has an invalid retry policy.",
);
expectInvalid(
  [meta(), attempt(2)],
  "The analysis stream must start with attempt 1.",
);
expectInvalid(
  [meta(), attempt(1, 3)],
  "The analysis stream changed its maximum attempt count.",
);
expectInvalid(
  [meta(), attempt(1), attempt(2)],
  "A new analysis attempt requires a retry event.",
);
expectInvalid(
  [meta(), attempt(1), partial(2, 1)],
  "A partial event does not belong to the current attempt.",
);
expectInvalid(
  [meta(), attempt(1), partial(1, 0)],
  "A partial event has an invalid sequence number.",
);
expectInvalid(
  [meta(), attempt(1), partial(1, 2), partial(1, 2)],
  "Partial events arrived out of order for the current attempt.",
);
expectInvalid(
  [meta(), attempt(1), retry(2, 2)],
  "A retry event does not belong to the current attempt.",
);
expectInvalid(
  [meta(), attempt(1), retry(1, 3)],
  "A retry event has an invalid next attempt.",
);
expectInvalid(
  [meta(1), attempt(1, 1), retry(1, 2)],
  "The analysis stream cannot retry beyond its attempt limit.",
);
expectInvalid(
  [meta(), attempt(1), retry(1, 2), partial(1, 3)],
  "A retry event must be followed by its next attempt.",
);
expectInvalid(
  [meta(), attempt(1), retry(1, 2), attempt(1)],
  "A retry event must be followed by its next attempt.",
);
expectInvalid(
  [meta(), attempt(1), complete(2)],
  "A terminal event does not belong to the current attempt.",
);
expectInvalid(
  [meta(), attempt(1), complete(1), partial(1, 2)],
  "The analysis stream continued after a terminal event.",
);
expectInvalid(
  [meta(), attempt(1), terminalError(1), complete(1)],
  "The analysis stream continued after a terminal event.",
);
expectInvalid(
  [
    meta(),
    {
      ...attempt(1),
      requestId: "43ef2fe4-a9d3-458e-b90f-4ae8fd3e51d4",
    },
  ],
  "The analysis stream changed request identity.",
);

// Rejected transitions must not corrupt the validator's last valid state.
const atomicState = createQuestionStreamProtocolValidator();
assert.equal(atomicState.validate(meta()), null);
assert.equal(
  atomicState.validate(attempt(2)),
  "The analysis stream must start with attempt 1.",
);
assert.equal(atomicState.validate(attempt(1)), null);
assert.equal(
  atomicState.validate(partial(1, 0)),
  "A partial event has an invalid sequence number.",
);
assert.equal(atomicState.validate(partial(1, 1)), null);
assert.equal(
  atomicState.validate(retry(1, 3)),
  "A retry event has an invalid next attempt.",
);
assert.equal(atomicState.validate(retry(1, 2)), null);
assert.equal(atomicState.validate(attempt(2)), null);
assert.equal(atomicState.validate(complete(2)), null);
assert.equal(atomicState.isComplete(), true);

process.stdout.write("Week 4 stream protocol checks passed.\n");
