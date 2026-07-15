import {
  AIQuotaResponseSchema,
  AIQuotaSchema,
  QuestionAnalysisStreamEventSchema,
  SimilarQuestionResponseSchema,
  type AIQuota,
  type QuestionAnalysisStreamEvent,
  type QuestionWorkbenchDraft,
  type SimilarQuestionResponse,
} from "./question-analysis-schema";
import { createQuestionStreamProtocolValidator } from "./question-stream-protocol.mjs";

const MAX_STREAM_BUFFER_CHARS = 256 * 1024;

export class QuestionWorkbenchRequestError extends Error {
  status: number;
  retryAfterSeconds?: number;
  code?: string;
  scope?: "hour" | "day";
  resetAt?: string;
  quota?: AIQuota;

  constructor(
    message: string,
    status: number,
    details: {
      retryAfterSeconds?: number;
      code?: string;
      scope?: "hour" | "day";
      resetAt?: string;
      quota?: AIQuota;
    } = {},
  ) {
    super(message);
    this.name = "QuestionWorkbenchRequestError";
    this.status = status;
    Object.assign(this, details);
  }
}

export class QuestionAnalysisStreamError extends Error {
  code: Extract<
    QuestionAnalysisStreamEvent,
    { type: "error" }
  >["error"]["code"];
  retryable: boolean;

  constructor(
    error: Extract<QuestionAnalysisStreamEvent, { type: "error" }>["error"],
  ) {
    super(error.message);
    this.name = "QuestionAnalysisStreamError";
    this.code = error.code;
    this.retryable = error.retryable;
  }
}

interface ErrorResponseDetails {
  message: string;
  code?: string;
  scope?: "hour" | "day";
  retryAfterSeconds?: number;
  resetAt?: string;
  quota?: AIQuota;
}

const errorDetailsFromResponse = async (
  response: Response,
): Promise<ErrorResponseDetails> => {
  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    // The generic status message below is safe for non-JSON proxy errors.
  }

  const error =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null
      ? body.error
      : undefined;
  const message =
    error && "message" in error && typeof error.message === "string"
      ? error.message
      : `Request failed with status ${response.status}.`;
  const code =
    error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  const scope =
    error &&
    "scope" in error &&
    (error.scope === "hour" || error.scope === "day")
      ? error.scope
      : undefined;
  const bodyRetryAfter =
    error &&
    "retryAfterSeconds" in error &&
    typeof error.retryAfterSeconds === "number" &&
    Number.isFinite(error.retryAfterSeconds) &&
    error.retryAfterSeconds > 0
      ? error.retryAfterSeconds
      : undefined;
  const headerRetryAfter = Number(response.headers.get("retry-after"));
  const retryAfterSeconds =
    bodyRetryAfter ??
    (Number.isFinite(headerRetryAfter) && headerRetryAfter > 0
      ? headerRetryAfter
      : undefined);
  const resetAt =
    error && "resetAt" in error && typeof error.resetAt === "string"
      ? error.resetAt
      : undefined;
  const quotaCandidate = error && "quota" in error ? error.quota : undefined;
  const parsedQuota = AIQuotaSchema.safeParse(quotaCandidate);

  return {
    message,
    code,
    scope,
    retryAfterSeconds,
    resetAt,
    quota: parsedQuota.success ? parsedQuota.data : undefined,
  };
};

const requestErrorFromResponse = async (response: Response) => {
  const details = await errorDetailsFromResponse(response);
  return new QuestionWorkbenchRequestError(
    details.message,
    response.status,
    details,
  );
};

export async function streamQuestionAnalysis(
  draft: QuestionWorkbenchDraft,
  options: {
    signal: AbortSignal;
    onEvent: (event: QuestionAnalysisStreamEvent) => void;
  },
) {
  const response = await fetch("/api/ai/questions/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
    signal: options.signal,
  });

  if (!response.ok) throw await requestErrorFromResponse(response);
  if (!response.body) {
    throw new QuestionWorkbenchRequestError(
      "The browser could not read the analysis stream.",
      502,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const protocol = createQuestionStreamProtocolValidator();

  const processLine = (line: string) => {
    if (line.length > MAX_STREAM_BUFFER_CHARS) {
      throw new QuestionWorkbenchRequestError(
        "The AI stream event was too large.",
        502,
      );
    }
    const trimmed = line.trim();
    if (!trimmed) return;

    let rawEvent: unknown;
    try {
      rawEvent = JSON.parse(trimmed) as unknown;
    } catch {
      throw new QuestionWorkbenchRequestError(
        "The AI returned a malformed stream event.",
        502,
      );
    }

    const parsed = QuestionAnalysisStreamEventSchema.safeParse(rawEvent);
    if (!parsed.success) {
      throw new QuestionWorkbenchRequestError(
        "The AI returned an invalid stream event.",
        502,
      );
    }

    const event = parsed.data;
    const protocolError = protocol.validate(event);
    if (protocolError) {
      throw new QuestionWorkbenchRequestError(protocolError, 502);
    }

    options.onEvent(event);
    if (event.type === "error") {
      throw new QuestionAnalysisStreamError(event.error);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
      // Only the unfinished line is bounded here. A proxy is free to combine
      // many small, valid NDJSON events into one network chunk.
      if (buffer.length > MAX_STREAM_BUFFER_CHARS) {
        throw new QuestionWorkbenchRequestError(
          "The AI stream event was too large.",
          502,
        );
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // The body can already be closed after a terminal stream event.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (!protocol.isComplete()) {
    throw new QuestionWorkbenchRequestError(
      "The analysis ended before a complete result arrived.",
      502,
    );
  }
}

export async function fetchAIQuota(signal: AbortSignal): Promise<AIQuota> {
  const response = await fetch("/api/ai/quota", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) throw await requestErrorFromResponse(response);

  let rawResponse: unknown;
  try {
    rawResponse = (await response.json()) as unknown;
  } catch {
    throw new QuestionWorkbenchRequestError(
      "The AI quota service returned invalid JSON.",
      502,
    );
  }

  const parsed = AIQuotaResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    throw new QuestionWorkbenchRequestError(
      "The AI quota service returned an invalid response.",
      502,
    );
  }

  return parsed.data.data;
}

export async function fetchSimilarQuestions(
  draft: QuestionWorkbenchDraft,
  signal: AbortSignal,
): Promise<SimilarQuestionResponse["data"]> {
  const response = await fetch("/api/questions/similar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
    signal,
  });

  if (!response.ok) throw await requestErrorFromResponse(response);

  let rawResponse: unknown;
  try {
    rawResponse = (await response.json()) as unknown;
  } catch {
    throw new QuestionWorkbenchRequestError(
      "The similarity service returned invalid JSON.",
      502,
    );
  }

  const parsed = SimilarQuestionResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    throw new QuestionWorkbenchRequestError(
      "The similarity service returned an invalid response.",
      502,
    );
  }

  return parsed.data.data;
}
