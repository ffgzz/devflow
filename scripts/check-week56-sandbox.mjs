import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  buildHtmlPreviewDocument,
  buildJavaScriptWorkerBootstrapModule,
  buildJavaScriptWorkerCompletionModule,
  buildJavaScriptWorkerSource,
  createSandboxEventValidator,
  formatConsoleValue,
  HTML_PREVIEW_SANDBOX,
  MAX_CONSOLE_VALUE_CHARS,
  MAX_SOURCE_CHARS,
  SANDBOX_CHANNEL,
  SANDBOX_PROTOCOL_VERSION,
} from "../lib/playground/sandbox-runtime.mjs";

const RUN_ID = "3af7f388-cd57-4d71-bdfc-e3e748f20e8a";
const RUNTIME_ORIGIN = "https://devflow.test";

const assertParsesAsModule = (source, filename) => {
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  assert.deepEqual(
    sourceFile.parseDiagnostics.map((diagnostic) => diagnostic.messageText),
    [],
    `${filename} must be valid module syntax.`,
  );
};

const event = (overrides = {}) => ({
  channel: SANDBOX_CHANNEL,
  v: SANDBOX_PROTOCOL_VERSION,
  runId: RUN_ID,
  source: "worker",
  seq: 1,
  type: "started",
  ...overrides,
});

assert.equal(formatConsoleValue(undefined), "undefined");
assert.equal(formatConsoleValue(-0), "-0");
assert.equal(formatConsoleValue(Number.NaN), "NaN");
assert.equal(formatConsoleValue(Infinity), "Infinity");
assert.equal(formatConsoleValue(12n), "12n");
assert.match(formatConsoleValue(Symbol("sandbox")), /Symbol\(sandbox\)/);
assert.match(formatConsoleValue(function demo() {}), /Function: demo/);
assert.match(formatConsoleValue(new Error("boom")), /Error: boom/);

const circular = { label: "root" };
circular.self = circular;
assert.match(formatConsoleValue(circular), /\[Circular\]/);

const throwingGetter = {};
Object.defineProperty(throwingGetter, "secret", {
  enumerable: true,
  get() {
    throw new Error("getter blocked");
  },
});
assert.match(formatConsoleValue(throwingGetter), /Thrown while reading/);
assert.ok(
  formatConsoleValue("x".repeat(MAX_CONSOLE_VALUE_CHARS * 2)).length <=
    MAX_CONSOLE_VALUE_CHARS,
);

const validator = createSandboxEventValidator({
  runId: RUN_ID,
  source: "worker",
});
assert.equal(validator.validate(event()), null);
assert.equal(
  validator.validate(
    event({
      type: "console",
      seq: 2,
      level: "log",
      values: ["hello", "{ safe: true }"],
    }),
  ),
  null,
);
assert.equal(
  validator.validate(
    event({ type: "result", seq: 3, value: "42", durationMs: 12.5 }),
  ),
  null,
);
assert.equal(validator.isTerminal(), true);
assert.equal(
  validator.validate(
    event({ type: "console", seq: 4, level: "log", values: ["late"] }),
  ),
  "Sandbox event arrived after the terminal event.",
);

const atomicValidator = createSandboxEventValidator({
  runId: RUN_ID,
  source: "worker",
});
assert.equal(
  atomicValidator.validate(event({ runId: "stale-run" })),
  "Sandbox event belongs to another run.",
);
assert.equal(atomicValidator.validate(event()), null);
assert.equal(
  atomicValidator.validate(
    event({ type: "console", seq: 1, level: "log", values: ["duplicate"] }),
  ),
  "Sandbox event sequence is invalid.",
);
assert.equal(
  atomicValidator.validate(
    event({ type: "console", seq: 2, level: "log", values: ["still valid"] }),
  ),
  null,
);
assert.equal(
  atomicValidator.validate(
    event({
      type: "runtime-error",
      seq: 3,
      phase: "runtime",
      error: { name: "Error", message: "boom" },
      durationMs: 5,
    }),
  ),
  null,
);

const missingStart = createSandboxEventValidator({
  runId: RUN_ID,
  source: "iframe",
});
assert.equal(
  missingStart.validate(event({ source: "iframe", type: "result", value: "ok" })),
  "Sandbox run must begin with a started event.",
);

const interactivePreviewValidator = createSandboxEventValidator({
  runId: RUN_ID,
  source: "iframe",
});
assert.equal(
  interactivePreviewValidator.validate(event({ source: "iframe" })),
  null,
);
assert.equal(
  interactivePreviewValidator.validate(
    event({
      source: "iframe",
      type: "result",
      seq: 2,
      value: "mounted",
      durationMs: 3,
    }),
  ),
  null,
);
assert.equal(interactivePreviewValidator.isTerminal(), false);
assert.equal(
  interactivePreviewValidator.validate(
    event({
      source: "iframe",
      type: "console",
      seq: 3,
      level: "log",
      values: ["clicked"],
    }),
  ),
  null,
);
assert.equal(
  interactivePreviewValidator.validate(
    event({
      source: "iframe",
      type: "runtime-error",
      seq: 4,
      phase: "runtime",
      error: { name: "Error", message: "click failed" },
      durationMs: 8,
    }),
  ),
  null,
);
assert.equal(interactivePreviewValidator.isTerminal(), true);

const workerSource = buildJavaScriptWorkerSource(`console.log("safe");
await Promise.resolve();
sandboxResult(42); // the builder must add a final newline`, RUNTIME_ORIGIN);
const workerBootstrap = buildJavaScriptWorkerBootstrapModule();
const workerCompletion = buildJavaScriptWorkerCompletionModule();
const checkedInWorkerBootstrap = await readFile(
  new URL("../public/playground-worker-bootstrap.mjs", import.meta.url),
  "utf8",
);
const checkedInWorkerCompletion = await readFile(
  new URL("../public/playground-worker-complete.mjs", import.meta.url),
  "utf8",
);
assert.equal(
  checkedInWorkerBootstrap,
  workerBootstrap,
  "Run pnpm generate:worker-runtime after changing the Worker bootstrap.",
);
assert.equal(
  checkedInWorkerCompletion,
  workerCompletion,
  "Run pnpm generate:worker-runtime after changing the Worker completion module.",
);
assertParsesAsModule(workerSource, "worker-entry.mjs");
assertParsesAsModule(workerBootstrap, "worker-bootstrap.mjs");
assertParsesAsModule(workerCompletion, "worker-complete.mjs");
assert.match(workerSource, /DEVFLOW_USER_MODULE_BEGIN/);
assert.match(
  workerSource,
  /https:\/\/devflow\.test\/playground-worker-bootstrap\.mjs/,
);
assert.match(
  workerSource,
  /https:\/\/devflow\.test\/playground-worker-complete\.mjs/,
);
assert.match(workerBootstrap, /replaceGlobal\("fetch"/);
assert.match(workerBootstrap, /replaceGlobal\("sandboxResult"/);
assert.match(workerCompletion, /bridge\.complete\(\)/);
assert.ok(!workerSource.includes("port.postMessage"));
assert.ok(!workerCompletion.includes("port.postMessage"));

const allWorkerModules = `${workerSource}\n${workerBootstrap}\n${workerCompletion}`;
assert.ok(!allWorkerModules.includes("eval("));
assert.ok(!allWorkerModules.includes("new Function"));
assert.ok(!allWorkerModules.includes("AsyncFunction"));

const uniqueUserToken = "__user_scope_must_stay_separate_7d42";
const isolatedUserModule = buildJavaScriptWorkerSource(
  `const ${uniqueUserToken} = true;\nsandboxResult(${uniqueUserToken});`,
  RUNTIME_ORIGIN,
);
assert.match(isolatedUserModule, new RegExp(uniqueUserToken));
assert.ok(!workerBootstrap.includes(uniqueUserToken));
assert.ok(!workerCompletion.includes(uniqueUserToken));
assertParsesAsModule(
  buildJavaScriptWorkerSource(
    `const closingTag = "</script>";\nsandboxResult(closingTag); // comment`,
    RUNTIME_ORIGIN,
  ),
  "worker-closing-tag.mjs",
);
assert.throws(
  () =>
    buildJavaScriptWorkerSource(
      "x".repeat(MAX_SOURCE_CHARS + 1),
      RUNTIME_ORIGIN,
    ),
  RangeError,
);
assert.throws(
  () => buildJavaScriptWorkerSource("sandboxResult(1);", "file:///tmp"),
  TypeError,
);

const previewDocument = buildHtmlPreviewDocument();
assert.equal(HTML_PREVIEW_SANDBOX, "allow-scripts");
assert.match(previewDocument, /sandboxed HTML preview|isolated preview/i);
assert.match(previewDocument, /default-src 'none'/);
assert.match(previewDocument, /connect-src 'none'/);
assert.match(previewDocument, /form-action 'none'/);
assert.match(previewDocument, /script\.textContent/);
assert.match(previewDocument, /event\.ports/);
assert.ok(!previewDocument.includes("allow-same-origin"));
assert.ok(!previewDocument.includes("unsafe-eval"));

process.stdout.write("Week 5-6 sandbox protocol and source checks passed.\n");
