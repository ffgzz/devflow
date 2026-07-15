"use client";

import type {
  SandboxPreviewState,
  SandboxStatus,
} from "@/lib/playground/types";
import { HTML_PREVIEW_SANDBOX } from "@/lib/playground/sandbox-runtime.mjs";
import { EyeIcon, ShieldCheckIcon } from "lucide-react";
import type { RefObject } from "react";

interface Props {
  preview: SandboxPreviewState | null;
  status: SandboxStatus;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onLoad: () => void;
}

const emptyMessage: Partial<Record<SandboxStatus, string>> = {
  stopped: "Preview stopped. Run again to create a fresh iframe.",
  "timed-out": "Preview was destroyed after reaching the time limit.",
  error: "The preview could not finish. Check the console for details.",
};

const PreviewFrame = ({ preview, status, iframeRef, onLoad }: Props) => (
  <section className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-700">
    <div className="flex min-h-12 items-center justify-between gap-3 border-b bg-slate-50 px-4 text-slate-800">
      <div className="flex items-center gap-2">
        <EyeIcon className="size-4 text-orange-500" />
        <h2 className="text-sm font-semibold">Isolated Preview</h2>
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
        <ShieldCheckIcon className="size-3.5" />
        opaque origin
      </span>
    </div>

    {preview ? (
      <iframe
        key={preview.key}
        ref={iframeRef}
        title="DevFlow code preview"
        sandbox={HTML_PREVIEW_SANDBOX}
        referrerPolicy="no-referrer"
        srcDoc={preview.srcDoc}
        onLoad={onLoad}
        className="min-h-[470px] w-full flex-1 border-0 bg-white"
      />
    ) : (
      <div className="flex min-h-[470px] flex-1 flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,_#fff7ed,_#ffffff_60%)] p-8 text-center text-slate-500">
        <div className="grid size-12 place-items-center rounded-2xl border border-orange-200 bg-white text-orange-500 shadow-sm">
          <EyeIcon className="size-5" />
        </div>
        <p className="max-w-sm text-sm">
          {emptyMessage[status] ??
            "Run the HTML/CSS/JS workspace to render it inside a sandboxed iframe."}
        </p>
      </div>
    )}
  </section>
);

export default PreviewFrame;
