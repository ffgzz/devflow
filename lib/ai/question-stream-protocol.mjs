const ERRORS = Object.freeze({
  invalidEvent: "The analysis stream event must be an object.",
  unsupportedVersion: "The analysis stream event has an unsupported version.",
  missingMeta: "The analysis stream must start with one metadata event.",
  repeatedMeta: "The analysis stream repeated its metadata event.",
  invalidRetryPolicy:
    "The analysis stream metadata has an invalid retry policy.",
  changedRequestId: "The analysis stream changed request identity.",
  afterTerminal: "The analysis stream continued after a terminal event.",
  attemptRequired: "The analysis stream must start attempt 1 before output.",
  invalidAttempt: "The analysis stream has an invalid attempt number.",
  changedMaxAttempts: "The analysis stream changed its maximum attempt count.",
  firstAttempt: "The analysis stream must start with attempt 1.",
  attemptWithoutRetry: "A new analysis attempt requires a retry event.",
  expectedRetryAttempt: "A retry event must be followed by its next attempt.",
  wrongPartialAttempt:
    "A partial event does not belong to the current attempt.",
  invalidSequence: "A partial event has an invalid sequence number.",
  outOfOrderSequence:
    "Partial events arrived out of order for the current attempt.",
  wrongRetryAttempt: "A retry event does not belong to the current attempt.",
  invalidNextAttempt: "A retry event has an invalid next attempt.",
  retryLimitReached:
    "The analysis stream cannot retry beyond its attempt limit.",
  wrongTerminalAttempt:
    "A terminal event does not belong to the current attempt.",
  unsupportedType: "The analysis stream event has an unsupported type.",
});

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

/**
 * Creates an isolated validator for one v2 question-analysis NDJSON stream.
 * Invalid events never advance the state, so callers can safely report the
 * returned error without leaving the validator half-transitioned.
 */
export function createQuestionStreamProtocolValidator() {
  let requestId;
  let maxAttempts;
  let seenMeta = false;
  let currentAttempt = 0;
  let expectedAttempt;
  let lastPartialSequence = 0;
  let terminalEventSeen = false;
  let completeEventSeen = false;

  return {
    /**
     * @param {unknown} event
     * @returns {string | null}
     */
    validate(event) {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return ERRORS.invalidEvent;
      }

      if (event.v !== 2) return ERRORS.unsupportedVersion;
      if (terminalEventSeen) return ERRORS.afterTerminal;

      if (!seenMeta) {
        if (event.type !== "meta") return ERRORS.missingMeta;

        const retryPolicy = event.retryPolicy;
        if (
          !retryPolicy ||
          typeof retryPolicy !== "object" ||
          Array.isArray(retryPolicy) ||
          !isPositiveInteger(retryPolicy.maxAttempts) ||
          typeof retryPolicy.attemptsShareQuota !== "boolean"
        ) {
          return ERRORS.invalidRetryPolicy;
        }

        seenMeta = true;
        requestId = event.requestId;
        maxAttempts = retryPolicy.maxAttempts;
        return null;
      }

      if (event.requestId !== requestId) return ERRORS.changedRequestId;
      if (event.type === "meta") return ERRORS.repeatedMeta;

      if (expectedAttempt !== undefined && event.type !== "attempt") {
        return ERRORS.expectedRetryAttempt;
      }

      if (event.type === "attempt") {
        if (!isPositiveInteger(event.attempt) || event.attempt > maxAttempts) {
          return ERRORS.invalidAttempt;
        }
        if (
          event.maxAttempts !== undefined &&
          event.maxAttempts !== maxAttempts
        ) {
          return ERRORS.changedMaxAttempts;
        }

        if (currentAttempt === 0) {
          if (event.attempt !== 1) return ERRORS.firstAttempt;
        } else if (expectedAttempt === undefined) {
          return ERRORS.attemptWithoutRetry;
        } else if (event.attempt !== expectedAttempt) {
          return ERRORS.expectedRetryAttempt;
        }

        currentAttempt = event.attempt;
        expectedAttempt = undefined;
        lastPartialSequence = 0;
        return null;
      }

      if (currentAttempt === 0) return ERRORS.attemptRequired;

      if (event.type === "partial") {
        if (event.attempt !== currentAttempt) return ERRORS.wrongPartialAttempt;
        if (!isPositiveInteger(event.seq)) return ERRORS.invalidSequence;
        if (event.seq <= lastPartialSequence) return ERRORS.outOfOrderSequence;

        lastPartialSequence = event.seq;
        return null;
      }

      if (event.type === "retry") {
        if (event.attempt !== currentAttempt) return ERRORS.wrongRetryAttempt;
        if (currentAttempt >= maxAttempts) return ERRORS.retryLimitReached;
        if (
          !isPositiveInteger(event.nextAttempt) ||
          event.nextAttempt !== currentAttempt + 1 ||
          event.nextAttempt > maxAttempts
        ) {
          return ERRORS.invalidNextAttempt;
        }

        expectedAttempt = event.nextAttempt;
        return null;
      }

      if (event.type === "complete" || event.type === "error") {
        if (event.attempt !== undefined && event.attempt !== currentAttempt) {
          return ERRORS.wrongTerminalAttempt;
        }

        terminalEventSeen = true;
        completeEventSeen = event.type === "complete";
        return null;
      }

      return ERRORS.unsupportedType;
    },

    isComplete() {
      return completeEventSeen;
    },
  };
}
