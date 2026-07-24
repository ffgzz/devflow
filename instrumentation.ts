import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // The local structured logger is Node-only. Edge errors can be connected to
  // an Edge-compatible provider later without increasing the default bundle.
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { reportServerRequestError } = await import(
    "./lib/observability/server"
  );

  await reportServerRequestError({ context, error, request });
};
