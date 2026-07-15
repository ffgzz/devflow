"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCodeSandbox } from "@/hooks/useCodeSandbox";
import { usePlaygroundProjects } from "@/hooks/usePlaygroundProjects";
import type { PlaygroundFiles, PlaygroundMode } from "@/lib/playground/types";
import {
  CheckCircle2Icon,
  Clock3Icon,
  CloudOffIcon,
  Code2Icon,
  DatabaseIcon,
  GitForkIcon,
  Loader2Icon,
  PlayIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SquareIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import CodeEditor from "./CodeEditor";
import ConsolePanel from "./ConsolePanel";
import PreviewFrame from "./PreviewFrame";

type WebFile = keyof Pick<PlaygroundFiles, "html" | "css" | "javascript">;

const timeoutOptions = [1_000, 3_000, 5_000, 10_000];

const fileDetails: Record<
  WebFile,
  { label: string; language: string }
> = {
  html: { label: "HTML", language: "html" },
  css: { label: "CSS", language: "css" },
  javascript: { label: "JavaScript", language: "javascript" },
};

const CodePlayground = () => {
  const {
    projects,
    currentProject,
    storageStatus,
    updateFile,
    renameProject,
    setMode,
    resetProject,
    selectProject,
    forkProject,
  } = usePlaygroundProjects();
  const {
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
    hasActiveRuntime,
  } = useCodeSandbox();
  const [activeWebFile, setActiveWebFile] = useState<WebFile>("html");
  const [timeoutMs, setTimeoutMs] = useState(3_000);

  if (!currentProject) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-dark400_light700">
        <Loader2Icon className="size-5 animate-spin" />
        Loading local workspace…
      </div>
    );
  }

  const isRunning = status === "starting" || status === "running";
  const canStop = isRunning || hasActiveRuntime;
  const execute = () => {
    if (isRunning) return;
    run({
      mode: currentProject.mode,
      files: currentProject.files,
      timeoutMs,
    });
  };

  const changeMode = (mode: PlaygroundMode) => {
    if (mode === currentProject.mode) return;
    resetRuntime();
    setMode(mode);
    if (mode === "web") setActiveWebFile("html");
  };

  const reset = () => {
    resetRuntime();
    resetProject();
    toast.success("The current workspace was reset to its starter template.");
  };

  const fork = () => {
    resetRuntime();
    const created = forkProject();
    if (!created) return;
    toast.success(`Created ${created.name}. The original stays unchanged.`);
  };

  return (
    <div className="pb-10">
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-orange-200/70 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_48%,#eff6ff_100%)] p-6 shadow-sm dark:border-orange-500/20 dark:bg-[linear-gradient(135deg,#20150d_0%,#0f1117_50%,#111827_100%)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-orange-300/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-orange-500 text-white">Code Lab</Badge>
              <Badge variant="outline" className="border-orange-300/70 text-orange-700 dark:text-orange-300">
                <ShieldCheckIcon /> isolated runtime
              </Badge>
            </div>
            <h1 className="text-dark100_light900 text-3xl font-bold tracking-tight sm:text-4xl">
              Run frontend code without leaving DevFlow
            </h1>
            <p className="text-dark400_light700 mt-3 max-w-2xl text-sm leading-6 sm:text-base">
              JavaScript runs in a disposable Worker. HTML/CSS/JS renders in an
              opaque-origin iframe. Logs, failures, timeout, reset, and Fork are
              all part of one reproducible workspace.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border bg-white/70 p-3 dark:bg-slate-900/60">
              <Code2Icon className="mx-auto mb-1 size-4 text-orange-500" />
              2 modes
            </div>
            <div className="rounded-xl border bg-white/70 p-3 dark:bg-slate-900/60">
              <Clock3Icon className="mx-auto mb-1 size-4 text-blue-500" />
              Worker hard stop
            </div>
            <div className="rounded-xl border bg-white/70 p-3 dark:bg-slate-900/60">
              <DatabaseIcon className="mx-auto mb-1 size-4 text-emerald-500" />
              local Forks
            </div>
          </div>
        </div>
      </header>

      <section className="background-light900_dark200 light-border mb-4 rounded-2xl border p-3 shadow-sm">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
            <Select
              value={currentProject.id}
              onValueChange={(projectId) => {
                resetRuntime();
                selectProject(projectId);
              }}
            >
              <SelectTrigger className="w-full md:w-56" aria-label="Select local workspace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name || "Untitled workspace"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              aria-label="Workspace name"
              value={currentProject.name}
              maxLength={60}
              onChange={(event) => renameProject(event.target.value)}
              onBlur={() => {
                if (!currentProject.name.trim()) renameProject("Untitled workspace");
              }}
              className="md:max-w-64"
            />

            <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
              <Button
                type="button"
                size="sm"
                variant={currentProject.mode === "javascript" ? "default" : "ghost"}
                onClick={() => changeMode("javascript")}
                aria-pressed={currentProject.mode === "javascript"}
                className={currentProject.mode === "javascript" ? "bg-orange-500 text-white hover:bg-orange-600" : ""}
              >
                <TerminalSquareIcon /> JavaScript
              </Button>
              <Button
                type="button"
                size="sm"
                variant={currentProject.mode === "web" ? "default" : "ghost"}
                onClick={() => changeMode("web")}
                aria-pressed={currentProject.mode === "web"}
                className={currentProject.mode === "web" ? "bg-orange-500 text-white hover:bg-orange-600" : ""}
              >
                <Code2Icon /> HTML / CSS / JS
              </Button>
            </div>

            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              {storageStatus === "saving" && <Loader2Icon className="size-3.5 animate-spin" />}
              {storageStatus === "saved" && <CheckCircle2Icon className="size-3.5 text-emerald-500" />}
              {storageStatus === "unavailable" && <CloudOffIcon className="size-3.5 text-amber-500" />}
              {storageStatus === "loading"
                ? "Loading…"
                : storageStatus === "saving"
                  ? "Saving locally…"
                  : storageStatus === "unavailable"
                    ? "Memory only"
                    : "Auto-saved locally"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(timeoutMs)}
              onValueChange={(value) => setTimeoutMs(Number(value))}
            >
              <SelectTrigger size="sm" aria-label="Execution timeout">
                <Clock3Icon />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeoutOptions.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value / 1_000}s timeout
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="button" variant="outline" onClick={fork}>
              <GitForkIcon /> Fork
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline">
                  <RotateCcwIcon /> Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset this workspace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its files will be replaced by the current mode&apos;s starter
                    template. Fork first if you want to keep this version.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={reset}>Reset files</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              type="button"
              variant="outline"
              disabled={!canStop}
              onClick={stop}
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <SquareIcon /> Stop
            </Button>
            <Button
              type="button"
              disabled={isRunning}
              onClick={execute}
              className="bg-orange-500 px-4 text-white hover:bg-orange-600"
            >
              {isRunning ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
              Run
              <kbd className="ml-1 hidden rounded border border-white/30 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                ⌘↵
              </kbd>
            </Button>
          </div>
        </div>
      </section>

      {currentProject.mode === "javascript" ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <section className="min-w-0 rounded-2xl border bg-card p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <h2 className="text-sm font-semibold">main.js</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Top-level await is supported; use sandboxResult(value) to
                  display a result.
                </p>
              </div>
              <Badge variant="outline">Worker thread</Badge>
            </div>
            <CodeEditor
              label="JavaScript"
              language="javascript"
              value={currentProject.files.javascript}
              onChange={(value) => updateFile("javascript", value)}
              onRun={execute}
            />
          </section>
          <ConsolePanel
            status={status}
            entries={entries}
            durationMs={durationMs}
            onClear={clearConsole}
            className="min-h-[596px]"
          />
        </div>
      ) : (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
            <section className="min-w-0 rounded-2xl border bg-card p-3 shadow-sm">
              <Tabs
                value={activeWebFile}
                onValueChange={(value) => setActiveWebFile(value as WebFile)}
              >
                <div className="mb-3 flex flex-col justify-between gap-2 px-1 sm:flex-row sm:items-center">
                  <TabsList className="w-full sm:w-auto">
                    {(Object.keys(fileDetails) as WebFile[]).map((file) => (
                      <TabsTrigger key={file} value={file} className="flex-1 sm:flex-none">
                        {fileDetails[file].label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <Badge variant="outline">3-file workspace</Badge>
                </div>

                {(Object.keys(fileDetails) as WebFile[]).map((file) => (
                  <TabsContent key={file} value={file}>
                    <CodeEditor
                      label={fileDetails[file].label}
                      language={fileDetails[file].language}
                      value={
                        file === "javascript"
                          ? currentProject.files.webJavascript
                          : currentProject.files[file]
                      }
                      onChange={(value) =>
                        updateFile(
                          file === "javascript" ? "webJavascript" : file,
                          value,
                        )
                      }
                      onRun={execute}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            <PreviewFrame
              preview={preview}
              status={status}
              iframeRef={iframeRef}
              onLoad={handlePreviewLoad}
            />
          </div>

          <ConsolePanel
            status={status}
            entries={entries}
            durationMs={durationMs}
            onClear={clearConsole}
            className="mt-4"
          />

          <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              The iframe blocks same-origin storage, forms, popups, top-level
              navigation, and direct network APIs. Its timeout reliably handles
              asynchronous work, but a synchronous infinite loop may still block
              a browser renderer; use JavaScript mode when you need a hard CPU
              stop.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default CodePlayground;
