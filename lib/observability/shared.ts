export const WEB_VITAL_NAMES = [
  "TTFB",
  "FCP",
  "LCP",
  "FID",
  "CLS",
  "INP",
] as const;

export const WEB_VITAL_RATINGS = [
  "good",
  "needs-improvement",
  "poor",
] as const;

export const NAVIGATION_TYPES = [
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
] as const;

export const CLIENT_ERROR_SOURCES = [
  "window-error",
  "unhandled-rejection",
  "react-boundary",
  "global-boundary",
  "handled-error",
] as const;

export type WebVitalName = (typeof WEB_VITAL_NAMES)[number];
export type WebVitalRating = (typeof WEB_VITAL_RATINGS)[number];
export type NavigationType = (typeof NAVIGATION_TYPES)[number];
export type ClientErrorSource = (typeof CLIENT_ERROR_SOURCES)[number];

export interface WebVitalEvent {
  kind: "web-vital";
  delta: number;
  metricId: string;
  name: WebVitalName;
  navigationType: NavigationType;
  path: string;
  rating: WebVitalRating;
  value: number;
}

export interface ClientErrorEvent {
  kind: "client-error";
  column?: number;
  digest?: string;
  errorName: string;
  fingerprint: string;
  line?: number;
  path: string;
  scriptPath?: string;
  source: ClientErrorSource;
}

export type BrowserObservabilityEvent = WebVitalEvent | ClientErrorEvent;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT_PATTERN = /^\d+$/;
const LONG_TOKEN_PATTERN = /^[a-z\d_-]{32,}$/i;

const maskPathSegment = (segment: string) => {
  if (
    segment.length > 32 ||
    /(?:%40|@)/i.test(segment) ||
    OBJECT_ID_PATTERN.test(segment) ||
    UUID_PATTERN.test(segment) ||
    NUMERIC_SEGMENT_PATTERN.test(segment) ||
    LONG_TOKEN_PATTERN.test(segment)
  ) {
    return ":id";
  }

  return segment.slice(0, 64);
};

/**
 * Removes query strings/fragments and masks common identifier-shaped route
 * segments before a path reaches logs or an external observability endpoint.
 */
export const sanitizePathname = (input: string) => {
  try {
    const pathname = new URL(input, "https://devflow.invalid").pathname;
    const sanitized = pathname
      .split("/")
      .filter(Boolean)
      .map(maskPathSegment)
      .join("/");

    return `/${sanitized}`.slice(0, 240) || "/";
  } catch {
    return "/unknown";
  }
};

export const sanitizeErrorName = (input: unknown) => {
  if (typeof input !== "string") return "UnknownError";

  const sanitized = input.trim().replace(/[^a-z\d_.:-]/gi, "").slice(0, 64);
  // Error names are useful as low-cardinality categories. Reject arbitrary
  // custom text (for example an email put into `error.name`) instead of
  // turning it into a log field that only looks sanitized.
  return /(?:error|exception)$/iu.test(sanitized)
    ? sanitized
    : "UnknownError";
};

export const getErrorName = (error: unknown) => {
  if (
    error instanceof Error ||
    (typeof DOMException !== "undefined" && error instanceof DOMException)
  ) {
    return sanitizeErrorName(error.name);
  }

  return "NonErrorRejection";
};

/**
 * A small non-cryptographic grouping key. It is deliberately built without an
 * error message or stack because those fields may contain user-provided text.
 */
export const createErrorFingerprint = (parts: Array<string | number>) => {
  const input = parts.join("|");
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};
