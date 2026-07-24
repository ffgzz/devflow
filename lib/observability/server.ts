import "server-only";

import logger from "@/lib/logger";
import { getErrorName, sanitizePathname } from "./shared";
import type { BrowserObservabilityEvent } from "./shared";

interface ServerErrorEvent {
  kind: "server-error";
  digest?: string;
  errorName: string;
  method: string;
  path: string;
  routePath: string;
  routeType: string;
  routerKind: string;
  runtime: string;
}

type ObservabilityEvent = BrowserObservabilityEvent | ServerErrorEvent;

const FORWARDED_HEADER = "x-devflow-observability-forwarded";
const FORWARD_TIMEOUT_MS = 1_500;

export const isServerObservabilityEnabled = () =>
  process.env.OBSERVABILITY_ENABLED === "true";

const getExternalEndpoint = () => {
  const configured = process.env.OBSERVABILITY_ENDPOINT;
  if (!configured) return null;

  try {
    const endpoint = new URL(configured);
    const mayUseInsecureLocalhost =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(endpoint.hostname);

    if (endpoint.protocol !== "https:" && !mayUseInsecureLocalhost) {
      return null;
    }

    return endpoint.toString();
  } catch {
    return null;
  }
};

const logEvent = (event: ObservabilityEvent) => {
  const data = {
    event,
    observabilitySchemaVersion: 1,
    service: "devflow",
  };

  if (event.kind === "server-error") {
    logger.error(data, "Observed server error");
  } else if (event.kind === "client-error") {
    logger.warn(data, "Observed client error");
  } else {
    logger.info(data, "Observed Web Vital");
  }
};

const forwardEvent = async (event: ObservabilityEvent) => {
  const endpoint = getExternalEndpoint();
  if (!endpoint) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      body: JSON.stringify({
        emittedAt: new Date().toISOString(),
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        event,
        schemaVersion: 1,
        service: "devflow",
      }),
      headers: {
        "Content-Type": "application/json",
        [FORWARDED_HEADER]: "1",
        ...(process.env.OBSERVABILITY_TOKEN
          ? { Authorization: `Bearer ${process.env.OBSERVABILITY_TOKEN}` }
          : {}),
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn(
        { eventKind: event.kind, status: response.status },
        "Observability endpoint rejected an event",
      );
    }
  } catch {
    logger.warn(
      { eventKind: event.kind },
      "Observability endpoint could not be reached",
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const recordObservabilityEvent = async (
  event: ObservabilityEvent,
  { forward = true }: { forward?: boolean } = {},
) => {
  if (!isServerObservabilityEnabled()) return;

  logEvent(event);
  if (forward) await forwardEvent(event);
};

export const reportServerRequestError = async ({
  context,
  error,
  request,
}: {
  context: {
    routePath: string;
    routeType: string;
    routerKind: string;
  };
  error: unknown;
  request: { method: string; path: string };
}) => {
  const digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest.slice(0, 128)
      : undefined;

  await recordObservabilityEvent({
    kind: "server-error",
    digest,
    errorName: getErrorName(error),
    method: request.method.slice(0, 12),
    path: sanitizePathname(request.path),
    routePath: context.routePath.slice(0, 240),
    routeType: context.routeType.slice(0, 32),
    routerKind: context.routerKind.slice(0, 32),
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
  });
};

export { FORWARDED_HEADER };
