"use client";

import { MAX_SOURCE_CHARS } from "@/lib/playground/sandbox-runtime.mjs";
import { useId, useMemo, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";

interface Props {
  label: string;
  language: string;
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
}

const CodeEditor = ({ label, language, value, onChange, onRun }: Props) => {
  const { t } = useI18n();
  const gutterRef = useRef<HTMLDivElement>(null);
  const tabCaptureRef = useRef(true);
  const keyboardHelpId = useId();
  const lineNumbers = useMemo(
    () => Array.from({ length: value.split("\n").length }, (_, index) => index + 1),
    [value],
  );

  return (
    <div className="relative flex h-[520px] min-h-0 overflow-hidden rounded-xl border border-slate-800 bg-[#0b1020] shadow-inner">
      <span id={keyboardHelpId} className="sr-only">
        {t("Press Escape, then Tab to leave the editor. Shift plus Tab always moves to the previous control.")}
      </span>
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="no-scrollbar w-14 shrink-0 overflow-hidden border-r border-slate-800 bg-[#090d18] px-3 py-4 text-right font-mono text-[13px] leading-6 text-slate-400 select-none"
      >
        {lineNumbers.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>

      <textarea
        aria-label={t("{label} code editor", { label })}
        aria-describedby={keyboardHelpId}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        data-language={language}
        value={value}
        maxLength={MAX_SOURCE_CHARS}
        spellCheck={false}
        wrap="off"
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutterRef.current) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onRun();
            return;
          }
          if (event.key === "Escape") {
            tabCaptureRef.current = false;
            return;
          }
          if (event.key !== "Tab") return;
          if (event.shiftKey || !tabCaptureRef.current) {
            tabCaptureRef.current = true;
            return;
          }

          event.preventDefault();
          const target = event.currentTarget;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const nextValue = `${value.slice(0, start)}  ${value.slice(end)}`;
          onChange(nextValue);
          requestAnimationFrame(() => {
            target.selectionStart = start + 2;
            target.selectionEnd = start + 2;
          });
        }}
        className="custom-scrollbar min-w-0 flex-1 resize-none overflow-auto bg-transparent p-4 font-mono text-[13px] leading-6 text-slate-100 caret-orange-400 outline-none placeholder:text-slate-600"
      />
    </div>
  );
};

export default CodeEditor;
