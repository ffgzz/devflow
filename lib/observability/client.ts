import {
  createErrorFingerprint,
  getErrorName,
  sanitizePathname,
  type BrowserObservabilityEvent,
  type ClientErrorSource,
  type NavigationType,
  type WebVitalEvent,
  type WebVitalName,
  type WebVitalRating,
} from "./shared";

const EVENTS_ENDPOINT = "/api/observability/events";
const MAX_EVENT_BYTES = 4_096;

const observabilityEnabled =
  process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED === "true";

const parseSampleRate = () => {
  const configured = Number(
    process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE ?? "0.1",
  );

  if (!Number.isFinite(configured)) return 0.1;
  return Math.min(1, Math.max(0, configured));
};

// One decision per page load keeps all metrics from that load together.
const reportWebVitalsForThisPage = Math.random() < parseSampleRate();

const sendEvent = (event: BrowserObservabilityEvent) => {
  if (!observabilityEnabled || typeof window === "undefined") return;

  const body = JSON.stringify(event);
  if (new Blob([body]).size > MAX_EVENT_BYTES) return;

  void fetch(EVENTS_ENDPOINT, {
    body,
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
    referrerPolicy: "no-referrer",
  }).catch(() => {
    // Monitoring must never break the application or trigger another report.
  });
};

const currentPath = () => sanitizePathname(window.location.pathname);

const sanitizeScriptPath = (filename: string | undefined) => {
  if (!filename) return undefined;

  try {
    const source = new URL(filename, window.location.origin);
    if (source.origin !== window.location.origin) return "[cross-origin]";
    return sanitizePathname(source.pathname);
  } catch {
    return undefined;
  }
};

const reportError = ({
  column,
  digest,
  error,
  filename,
  line,
  source,
}: {
  column?: number;
  digest?: string;
  error: unknown;
  filename?: string;
  line?: number;
  source: ClientErrorSource;
}) => {
  const errorName = getErrorName(error);
  const path = currentPath();
  const scriptPath = sanitizeScriptPath(filename);
  const safeDigest = digest?.slice(0, 128);

  sendEvent({
    kind: "client-error",
    column,
    digest: safeDigest,
    errorName,
    fingerprint: createErrorFingerprint([
      source,
      errorName,
      safeDigest ?? scriptPath ?? path,
      line ?? 0,
      column ?? 0,
    ]),
    line,
    path,
    scriptPath,
    source,
  });
};

export const reportWebVital = (metric: {
  delta: number;
  id: string;
  name: string;
  navigationType: string;
  rating: string;
  value: number;
}) => {
  if (!reportWebVitalsForThisPage) return;

  const event: WebVitalEvent = {
    kind: "web-vital",
    delta: metric.delta,
    metricId: metric.id.slice(0, 128),
    name: metric.name as WebVitalName,
    navigationType: metric.navigationType as NavigationType,
    path: currentPath(),
    rating: metric.rating as WebVitalRating,
    value: metric.value,
  };

  sendEvent(event);
};

export const reportBoundaryError = (
  error: Error & { digest?: string },
  source: "react-boundary" | "global-boundary",
) => {
  reportError({
    digest: error.digest,
    error,
    source,
  });
};

export const reportHandledClientError = (error: unknown) => {
  reportError({ error, source: "handled-error" });
};

let globalHandlersInstalled = false;

export const installGlobalErrorHandlers = () => {
  if (!observabilityEnabled || globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    reportError({
      column: event.colno || undefined,
      error: event.error,
      filename: event.filename || undefined,
      line: event.lineno || undefined,
      source: "window-error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError({
      error: event.reason,
      source: "unhandled-rejection",
    });
  });
};
