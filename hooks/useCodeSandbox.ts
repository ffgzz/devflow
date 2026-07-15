"use client";

import {
  buildHtmlPreviewDocument,
  buildJavaScriptWorkerSource,
  createSandboxEventValidator,
  MAX_CONSOLE_ENTRIES,
  SANDBOX_CHANNEL,
  SANDBOX_PROTOCOL_VERSION,
} from "@/lib/playground/sandbox-runtime.mjs";
import { createProjectId } from "@/lib/playground/templates";
import type {
  PlaygroundFiles,
  PlaygroundMode,
  SandboxConsoleEntry,
  SandboxEvent,
  SandboxPreviewState,
  SandboxSource,
  SandboxStatus,
} from "@/lib/playground/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface SandboxValidator {
  validate: (event: unknown) => string | null;
}

interface ActiveRun {
  runId: string;
  mode: PlaygroundMode;
  source: SandboxSource;
  startedAt: number;
  timeoutId: number;
  validator: SandboxValidator;
  completed?: boolean;
  worker?: Worker;
  objectUrl?: string;
  port?: MessagePort;
}

interface PendingWebStart {
  runId: string;
  files: PlaygroundFiles;
}

const MAX_RENDERED_ENTRIES = MAX_CONSOLE_ENTRIES + 12;

const statusEntry = (
  runId: string,
  text: string,
  level: SandboxConsoleEntry["level"] = "info",
): SandboxConsoleEntry => ({
  id: `${runId}:system:${Date.now()}:${Math.random()}`,
  runId,
  kind: "system",
  level,
  text,
  seq: 0,
});

export const useCodeSandbox = () => {
  const [status, setStatus] = useState<SandboxStatus>("idle");
  const [entries, setEntries] = useState<SandboxConsoleEntry[]>([]);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [preview, setPreview] = useState<SandboxPreviewState | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeRunRef = useRef<ActiveRun | null>(null);
  const pendingWebStartRef = useRef<PendingWebStart | null>(null);
  const previewKeyRef = useRef(0);

  const appendEntry = useCallback((entry: SandboxConsoleEntry) => {
    setEntries((current) =>
      [...current, entry].slice(-MAX_RENDERED_ENTRIES),
    );
  }, []);

  const releaseActive = useCallback(
    (active: ActiveRun, options: { clearPreview?: boolean } = {}) => {
      window.clearTimeout(active.timeoutId);
      active.port?.close();
      active.worker?.terminate();
      if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
      if (activeRunRef.current?.runId === active.runId) {
        activeRunRef.current = null;
      }
      if (pendingWebStartRef.current?.runId === active.runId) {
        pendingWebStartRef.current = null;
      }
      if (options.clearPreview && active.mode === "web") setPreview(null);
    },
    [],
  );

  const failHostRun = useCallback(
    (runId: string, message: string, clearPreview = true) => {
      const active = activeRunRef.current;
      if (!active || active.runId !== runId) return;
      const elapsed = Math.max(0, performance.now() - active.startedAt);
      releaseActive(active, { clearPreview });
      setDurationMs(elapsed);
      setStatus("error");
      appendEntry({
        id: `${runId}:host-error`,
        runId,
        kind: "error",
        level: "error",
        text: message,
        seq: Number.MAX_SAFE_INTEGER,
      });
    },
    [appendEntry, releaseActive],
  );

  const handleSandboxEvent = useCallback(
    (rawEvent: unknown) => {
      const active = activeRunRef.current;
      if (!active) return;

      const candidate = rawEvent as Partial<SandboxEvent> | null;
      if (candidate?.runId !== active.runId) return;
      const protocolError = active.validator.validate(rawEvent);
      if (protocolError) {
        failHostRun(
          active.runId,
          `The isolated runtime sent an invalid event: ${protocolError}`,
        );
        return;
      }

      const event = rawEvent as SandboxEvent;
      if (event.type === "started") {
        setStatus("running");
        return;
      }

      if (event.type === "console") {
        appendEntry({
          id: `${event.runId}:${event.seq}`,
          runId: event.runId,
          kind: "console",
          level: event.level,
          text: event.values.length > 0 ? event.values.join(" ") : "(no arguments)",
          seq: event.seq,
        });
        return;
      }

      if (event.type === "result") {
        window.clearTimeout(active.timeoutId);
        if (active.mode === "web") active.completed = true;
        else releaseActive(active);
        setDurationMs(event.durationMs);
        setStatus("success");
        appendEntry({
          id: `${event.runId}:${event.seq}`,
          runId: event.runId,
          kind: "result",
          level: "info",
          text: `Returned: ${event.value}`,
          seq: event.seq,
        });
        return;
      }

      releaseActive(active, { clearPreview: active.mode === "web" });
      setDurationMs(event.durationMs);
      setStatus("error");
      const phase = event.phase.replaceAll("-", " ");
      appendEntry({
        id: `${event.runId}:${event.seq}`,
        runId: event.runId,
        kind: "error",
        level: "error",
        text: `${event.error.name} (${phase}): ${event.error.message}${
          event.error.stack ? `\n${event.error.stack}` : ""
        }`,
        seq: event.seq,
      });
    },
    [appendEntry, failHostRun, releaseActive],
  );

  const stop = useCallback(() => {
    const active = activeRunRef.current;
    if (!active) return;
    const elapsed = Math.max(0, performance.now() - active.startedAt);
    releaseActive(active, { clearPreview: true });
    setDurationMs(elapsed);
    setStatus("stopped");
    appendEntry(statusEntry(active.runId, "Run stopped by the user.", "warn"));
  }, [appendEntry, releaseActive]);

  const clearConsole = useCallback(() => setEntries([]), []);

  const resetRuntime = useCallback(() => {
    const active = activeRunRef.current;
    if (active) releaseActive(active, { clearPreview: true });
    pendingWebStartRef.current = null;
    setPreview(null);
    setEntries([]);
    setDurationMs(null);
    setStatus("idle");
  }, [releaseActive]);

  const startTimeout = useCallback(
    (active: Omit<ActiveRun, "timeoutId">, timeoutMs: number): ActiveRun => {
      const timeoutId = window.setTimeout(() => {
        const current = activeRunRef.current;
        if (!current || current.runId !== active.runId) return;
        releaseActive(current, { clearPreview: true });
        setDurationMs(timeoutMs);
        setStatus("timed-out");
        appendEntry(
          statusEntry(
            active.runId,
            `Execution exceeded ${timeoutMs} ms and was terminated.`,
            "error",
          ),
        );
      }, timeoutMs);
      return { ...active, timeoutId };
    },
    [appendEntry, releaseActive],
  );

  const run = useCallback(
    ({
      mode,
      files,
      timeoutMs,
    }: {
      mode: PlaygroundMode;
      files: PlaygroundFiles;
      timeoutMs: number;
    }) => {
      const previous = activeRunRef.current;
      if (previous) releaseActive(previous, { clearPreview: true });
      pendingWebStartRef.current = null;
      if (mode === "web") setPreview(null);

      const runId = createProjectId();
      const source: SandboxSource = mode === "javascript" ? "worker" : "iframe";
      setEntries([
        statusEntry(
          runId,
          mode === "javascript"
            ? "Starting isolated Web Worker…"
            : "Starting sandboxed HTML preview…",
        ),
      ]);
      setDurationMs(null);
      setStatus("starting");

      const base = {
        runId,
        mode,
        source,
        startedAt: performance.now(),
        validator: createSandboxEventValidator({ runId, source }),
      };
      const active = startTimeout(base, timeoutMs);
      activeRunRef.current = active;

      if (mode === "web") {
        try {
          pendingWebStartRef.current = {
            runId,
            files: { ...files, javascript: files.webJavascript },
          };
          setPreview({
            key: ++previewKeyRef.current,
            srcDoc: buildHtmlPreviewDocument(),
          });
        } catch (error) {
          failHostRun(
            runId,
            error instanceof Error ? error.message : "Preview could not start.",
          );
        }
        return;
      }

      let objectUrl: string | null = null;
      try {
        const workerSource = buildJavaScriptWorkerSource(
          files.javascript,
          window.location.origin,
        );
        objectUrl = URL.createObjectURL(
          new Blob([workerSource], { type: "text/javascript" }),
        );
        const worker = new Worker(objectUrl, {
          name: "devflow-code-sandbox",
          type: "module",
        });
        const channel = new MessageChannel();
        active.worker = worker;
        active.objectUrl = objectUrl;
        objectUrl = null;
        active.port = channel.port1;
        channel.port1.onmessage = (event) => handleSandboxEvent(event.data);
        channel.port1.start();
        worker.onerror = (event) => {
          event.preventDefault();
          failHostRun(
            runId,
            `JavaScript Worker failed to start or compile: ${event.message || "Unknown Worker error."}`,
          );
        };
        worker.postMessage(
          {
            channel: SANDBOX_CHANNEL,
            v: SANDBOX_PROTOCOL_VERSION,
            type: "start",
            runId,
          },
          [channel.port2],
        );
      } catch (error) {
        failHostRun(
          runId,
          error instanceof Error ? error.message : "Worker could not start.",
        );
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    },
    [failHostRun, handleSandboxEvent, releaseActive, startTimeout],
  );

  const handlePreviewLoad = useCallback(() => {
    const pending = pendingWebStartRef.current;
    const active = activeRunRef.current;
    const target = iframeRef.current?.contentWindow;
    if (!pending || !active || pending.runId !== active.runId || !target) return;

    const channel = new MessageChannel();
    active.port = channel.port1;
    channel.port1.onmessage = (event) => handleSandboxEvent(event.data);
    channel.port1.start();
    target.postMessage(
      {
        channel: SANDBOX_CHANNEL,
        v: SANDBOX_PROTOCOL_VERSION,
        type: "start",
        runId: pending.runId,
        files: pending.files,
      },
      "*",
      [channel.port2],
    );
    pendingWebStartRef.current = null;
  }, [handleSandboxEvent]);

  useEffect(
    () => () => {
      const active = activeRunRef.current;
      if (!active) return;
      window.clearTimeout(active.timeoutId);
      active.port?.close();
      active.worker?.terminate();
      if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
      activeRunRef.current = null;
    },
    [],
  );

  return {
    status,
    entries,
    durationMs,
    preview,
    iframeRef,
    run,
    stop,
    clearConsole,
    resetRuntime,
    handlePreviewLoad,
    hasActiveRuntime: activeRunRef.current !== null,
  };
};
