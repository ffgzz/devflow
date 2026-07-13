import {
  QuestionAnalysisStreamEventSchema,
  SimilarQuestionResponseSchema,
  type QuestionAnalysisStreamEvent,
  type QuestionWorkbenchDraft,
  type SimilarQuestionResponse,
} from "./question-analysis-schema";

const MAX_STREAM_BUFFER_CHARS = 256 * 1024;

export class QuestionWorkbenchRequestError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "QuestionWorkbenchRequestError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class QuestionAnalysisStreamError extends Error {
  code: Extract<
    QuestionAnalysisStreamEvent,
    { type: "error" }
  >["error"]["code"];
  retryable: boolean;

  constructor(
    error: Extract<
      QuestionAnalysisStreamEvent,
      { type: "error" }
    >["error"],
  ) {
    super(error.message);
    this.name = "QuestionAnalysisStreamError";
    this.code = error.code;
    this.retryable = error.retryable;
  }
}

const errorMessageFromResponse = async (response: Response) => {
  try {
    const value = (await response.json()) as {
      error?: { message?: unknown };
    };
    if (typeof value.error?.message === "string") {
      return value.error.message;
    }
  } catch {
    // The generic status message below is safe for non-JSON proxy errors.
  }

  return `Request failed with status ${response.status}.`;
};

const requestErrorFromResponse = async (response: Response) => {
  const retryAfter = Number(response.headers.get("retry-after"));
  return new QuestionWorkbenchRequestError(
    await errorMessageFromResponse(response),
    response.status,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
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
  let completed = false;
  let serverRequestId: string | undefined;
  let seenMeta = false;
  let lastSequence = 0;
  let terminalEventSeen = false;

  const processLine = (line: string) => {
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
    serverRequestId ??= event.requestId;
    if (event.requestId !== serverRequestId) {
      throw new QuestionWorkbenchRequestError(
        "The analysis stream changed request identity.",
        502,
      );
    }

    if (!seenMeta && event.type !== "meta") {
      throw new QuestionWorkbenchRequestError(
        "The analysis stream did not start with metadata.",
        502,
      );
    }
    if (event.type === "meta") {
      if (seenMeta) {
        throw new QuestionWorkbenchRequestError(
          "The analysis stream repeated its metadata event.",
          502,
        );
      }
      seenMeta = true;
    } else if (terminalEventSeen) {
      throw new QuestionWorkbenchRequestError(
        "The analysis stream continued after a terminal event.",
        502,
      );
    }
    if (event.type === "partial") {
      if (event.seq <= lastSequence) {
        throw new QuestionWorkbenchRequestError(
          "The analysis stream events arrived out of order.",
          502,
        );
      }
      lastSequence = event.seq;
    }
    if (event.type === "complete" || event.type === "error") {
      terminalEventSeen = true;
    }

    options.onEvent(event);
    if (event.type === "complete") completed = true;
    if (event.type === "error") {
      throw new QuestionAnalysisStreamError(event.error);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_STREAM_BUFFER_CHARS) {
        throw new QuestionWorkbenchRequestError(
          "The AI stream event was too large.",
          502,
        );
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
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

  if (!completed) {
    throw new QuestionWorkbenchRequestError(
      "The analysis ended before a complete result arrived.",
      502,
    );
  }
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
