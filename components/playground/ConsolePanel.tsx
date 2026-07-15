"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  SandboxConsoleEntry,
  SandboxStatus,
} from "@/lib/playground/types";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock3Icon,
  Loader2Icon,
  TerminalIcon,
  Trash2Icon,
} from "lucide-react";

interface Props {
  status: SandboxStatus;
  entries: SandboxConsoleEntry[];
  durationMs: number | null;
  onClear: () => void;
  className?: string;
}

const statusDetails: Record<
  SandboxStatus,
  { label: string; className: string }
> = {
  idle: { label: "Idle", className: "border-slate-700 text-slate-400" },
  starting: {
    label: "Starting",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  },
  running: {
    label: "Running",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  success: {
    label: "Completed",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  error: {
    label: "Failed",
    className: "border-red-500/40 bg-red-500/10 text-red-300",
  },
  stopped: {
    label: "Stopped",
    className: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  },
  "timed-out": {
    label: "Timed out",
    className: "border-red-500/40 bg-red-500/10 text-red-300",
  },
};

const levelClass: Record<SandboxConsoleEntry["level"], string> = {
  log: "text-slate-200",
  info: "text-sky-300",
  warn: "text-amber-300",
  error: "text-red-300",
};

const ConsolePanel = ({
  status,
  entries,
  durationMs,
  onClear,
  className = "",
}: Props) => {
  const detail = statusDetails[status];

  return (
    <section
      aria-label="Sandbox console"
      className={`flex min-h-[260px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#090d18] ${className}`}
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-800 px-4">
        <div className="flex items-center gap-2">
          <TerminalIcon className="size-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-100">Console</h2>
          <Badge variant="outline" className={detail.className}>
            {(status === "starting" || status === "running") && (
              <Loader2Icon className="animate-spin" />
            )}
            {status === "success" && <CheckCircle2Icon />}
            {(status === "error" || status === "timed-out") && (
              <CircleAlertIcon />
            )}
            {detail.label}
          </Badge>
          {durationMs !== null && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock3Icon className="size-3" />
              {Math.round(durationMs)} ms
            </span>
          )}
        </div>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Clear console"
          onClick={onClear}
          className="text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <Trash2Icon />
        </Button>
      </div>

      <div
        aria-live="polite"
        className="custom-scrollbar max-h-[390px] min-h-[210px] flex-1 overflow-auto p-4 font-mono text-xs leading-6"
      >
        {entries.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-slate-600">
            <TerminalIcon className="size-7" />
            <p>Run the code to see logs, result values, and errors.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[20px_minmax(0,1fr)] border-b border-slate-800/70 py-1.5 last:border-0"
            >
              <span className="text-slate-600" aria-hidden="true">
                {entry.kind === "result" ? "←" : entry.level === "error" ? "×" : ">"}
              </span>
              <pre
                className={`m-0 min-w-0 whitespace-pre-wrap break-words bg-transparent p-0 font-mono ${levelClass[entry.level]}`}
              >
                {entry.text}
              </pre>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default ConsolePanel;
