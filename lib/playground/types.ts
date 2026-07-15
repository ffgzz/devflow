export type PlaygroundMode = "javascript" | "web";

export interface PlaygroundFiles {
  javascript: string;
  webJavascript: string;
  html: string;
  css: string;
}

export interface PlaygroundProject {
  id: string;
  version: 1;
  name: string;
  mode: PlaygroundMode;
  files: PlaygroundFiles;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
}

export type PlaygroundStorageStatus =
  | "loading"
  | "idle"
  | "saving"
  | "saved"
  | "unavailable";

export type SandboxSource = "worker" | "iframe";
export type SandboxStatus =
  | "idle"
  | "starting"
  | "running"
  | "success"
  | "error"
  | "stopped"
  | "timed-out";

export type SandboxConsoleLevel = "log" | "info" | "warn" | "error";
export type SandboxRuntimePhase =
  | "compile"
  | "runtime"
  | "unhandled-rejection";

interface SandboxEventBase {
  channel: "devflow:sandbox";
  v: 1;
  runId: string;
  source: SandboxSource;
  seq: number;
}

export type SandboxEvent =
  | (SandboxEventBase & { type: "started" })
  | (SandboxEventBase & {
      type: "console";
      level: SandboxConsoleLevel;
      values: string[];
    })
  | (SandboxEventBase & {
      type: "result";
      value: string;
      durationMs: number;
    })
  | (SandboxEventBase & {
      type: "runtime-error";
      phase: SandboxRuntimePhase;
      error: { name: string; message: string; stack?: string };
      durationMs: number;
    });

export interface SandboxConsoleEntry {
  id: string;
  runId: string;
  kind: "system" | "console" | "result" | "error";
  level: SandboxConsoleLevel;
  text: string;
  seq: number;
}

export interface SandboxPreviewState {
  key: number;
  srcDoc: string;
}
