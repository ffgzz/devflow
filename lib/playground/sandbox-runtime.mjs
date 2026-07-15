export const SANDBOX_CHANNEL = "devflow:sandbox";
export const SANDBOX_PROTOCOL_VERSION = 1;
export const HTML_PREVIEW_SANDBOX = "allow-scripts";
export const MAX_SOURCE_CHARS = 120_000;
export const MAX_CONSOLE_ENTRIES = 200;
export const MAX_CONSOLE_ARGUMENTS = 12;
export const MAX_CONSOLE_VALUE_CHARS = 4_000;

const SOURCES = new Set(["worker", "iframe"]);
const CONSOLE_LEVELS = new Set(["log", "info", "warn", "error"]);
const RUNTIME_PHASES = new Set([
  "compile",
  "runtime",
  "unhandled-rejection",
]);

const isNonNegativeFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const hasOnlyBoundedStrings = (values) =>
  Array.isArray(values) &&
  values.length <= MAX_CONSOLE_ARGUMENTS &&
  values.every(
    (value) =>
      typeof value === "string" && value.length <= MAX_CONSOLE_VALUE_CHARS,
  );

/**
 * Formats an arbitrary console value into bounded plain text. This function is
 * intentionally self-contained because its source is injected into the
 * isolated Worker and iframe runtimes.
 */
export function formatConsoleValue(value, options = {}) {
  const maxDepth = Number.isInteger(options.maxDepth)
    ? Math.max(0, options.maxDepth)
    : 3;
  const maxItems = Number.isInteger(options.maxItems)
    ? Math.max(1, options.maxItems)
    : 25;
  const maxLength = Number.isInteger(options.maxLength)
    ? Math.max(64, options.maxLength)
    : 4_000;
  const seen = new WeakSet();

  const crop = (text) => {
    const normalized = String(text).replace(/\r\n/g, "\n");
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 16))}… [truncated]`;
  };

  const inspect = (current, depth) => {
    try {
      if (current === null) return "null";
      if (current === undefined) return "undefined";
      if (typeof current === "string") return crop(current);
      if (typeof current === "number") {
        if (Object.is(current, -0)) return "-0";
        if (Number.isNaN(current)) return "NaN";
        if (current === Infinity) return "Infinity";
        if (current === -Infinity) return "-Infinity";
        return String(current);
      }
      if (typeof current === "bigint") return `${current.toString()}n`;
      if (typeof current === "boolean") return String(current);
      if (typeof current === "symbol") return current.toString();
      if (typeof current === "function") {
        return `[Function${current.name ? `: ${current.name}` : ""}]`;
      }

      if (current instanceof Error) {
        const heading = `${current.name || "Error"}: ${current.message || ""}`;
        const stack = typeof current.stack === "string" ? current.stack : "";
        return crop(stack.startsWith(heading) ? stack : `${heading}${stack ? `\n${stack}` : ""}`);
      }
      if (current instanceof Date) {
        return Number.isNaN(current.getTime())
          ? "Invalid Date"
          : `Date(${current.toISOString()})`;
      }
      if (current instanceof RegExp) return current.toString();

      if (seen.has(current)) return "[Circular]";
      seen.add(current);

      if (depth >= maxDepth) {
        let name = "Object";
        try {
          name = current?.constructor?.name || name;
        } catch {
          // Proxies may throw while reading their constructor.
        }
        return `[${name}]`;
      }

      if (Array.isArray(current)) {
        const output = [];
        const length = Math.min(current.length, maxItems);
        for (let index = 0; index < length; index += 1) {
          try {
            output.push(inspect(current[index], depth + 1));
          } catch {
            output.push("[Unreadable]");
          }
        }
        if (current.length > maxItems) {
          output.push(`… ${current.length - maxItems} more`);
        }
        return crop(`[${output.join(", ")}]`);
      }

      let keys;
      try {
        keys = Reflect.ownKeys(current).slice(0, maxItems);
      } catch {
        return "[Uninspectable Object]";
      }

      const fields = keys.map((key) => {
        const label = typeof key === "symbol" ? key.toString() : String(key);
        try {
          return `${label}: ${inspect(current[key], depth + 1)}`;
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? `: ${error.message}`
              : "";
          return `${label}: [Thrown while reading${message}]`;
        }
      });

      try {
        const totalKeys = Reflect.ownKeys(current).length;
        if (totalKeys > maxItems) fields.push(`… ${totalKeys - maxItems} more`);
      } catch {
        // The visible subset above is still useful.
      }

      return crop(`{ ${fields.join(", ")} }`);
    } catch {
      return "[Unserializable]";
    }
  };

  return crop(inspect(value, 0));
}

/** Kept self-contained for injection into both runtimes. */
export function normalizeRuntimeError(error) {
  try {
    if (error instanceof Error) {
      return {
        name: String(error.name || "Error").slice(0, 120),
        message: String(error.message || "Unknown runtime error").slice(
          0,
          4_000,
        ),
        stack:
          typeof error.stack === "string"
            ? error.stack.slice(0, 12_000)
            : undefined,
      };
    }

    return {
      name: "Error",
      message: String(error ?? "Unknown runtime error").slice(0, 4_000),
      stack: undefined,
    };
  } catch {
    return {
      name: "Error",
      message: "The thrown value could not be inspected.",
      stack: undefined,
    };
  }
}

/**
 * Stateful fail-closed validator for one sandbox run. Invalid messages never
 * advance sequence or lifecycle state.
 */
export function createSandboxEventValidator({ runId, source }) {
  if (typeof runId !== "string" || runId.length === 0) {
    throw new Error("A sandbox validator requires a runId.");
  }
  if (!SOURCES.has(source)) {
    throw new Error("A sandbox validator requires a known source.");
  }

  let started = false;
  let completed = false;
  let terminal = false;
  let lastSequence = 0;

  return {
    validate(event) {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return "Sandbox event must be an object.";
      }
      if (event.channel !== SANDBOX_CHANNEL) {
        return "Sandbox event used an unknown channel.";
      }
      if (event.v !== SANDBOX_PROTOCOL_VERSION) {
        return "Sandbox event used an unsupported protocol version.";
      }
      if (event.runId !== runId) {
        return "Sandbox event belongs to another run.";
      }
      if (event.source !== source) {
        return "Sandbox event used an unexpected source.";
      }
      if (!Number.isInteger(event.seq) || event.seq <= lastSequence) {
        return "Sandbox event sequence is invalid.";
      }
      if (terminal) {
        return "Sandbox event arrived after the terminal event.";
      }

      if (!started && event.type !== "started") {
        return "Sandbox run must begin with a started event.";
      }
      if (started && event.type === "started") {
        return "Sandbox run repeated its started event.";
      }

      if (event.type === "started") {
        started = true;
        lastSequence = event.seq;
        return null;
      }

      if (event.type === "console") {
        if (!CONSOLE_LEVELS.has(event.level)) {
          return "Sandbox console event used an invalid level.";
        }
        if (!hasOnlyBoundedStrings(event.values)) {
          return "Sandbox console output exceeded its bounds.";
        }
        lastSequence = event.seq;
        return null;
      }

      if (event.type === "result") {
        if (completed) return "Sandbox run repeated its result event.";
        if (
          typeof event.value !== "string" ||
          event.value.length > MAX_CONSOLE_VALUE_CHARS ||
          !isNonNegativeFiniteNumber(event.durationMs)
        ) {
          return "Sandbox result event is invalid.";
        }
        lastSequence = event.seq;
        completed = true;
        terminal = source === "worker";
        return null;
      }

      if (event.type === "runtime-error") {
        const details = event.error;
        if (
          !RUNTIME_PHASES.has(event.phase) ||
          !details ||
          typeof details !== "object" ||
          typeof details.name !== "string" ||
          details.name.length > 120 ||
          typeof details.message !== "string" ||
          details.message.length > 4_000 ||
          (details.stack !== undefined &&
            (typeof details.stack !== "string" ||
              details.stack.length > 12_000)) ||
          !isNonNegativeFiniteNumber(event.durationMs)
        ) {
          return "Sandbox runtime error event is invalid.";
        }
        lastSequence = event.seq;
        terminal = true;
        return null;
      }

      return "Sandbox event used an unknown type.";
    },

    isTerminal() {
      return terminal;
    },
  };
}

const assertSource = (source, label) => {
  if (typeof source !== "string") {
    throw new TypeError(`${label} source must be a string.`);
  }
  if (source.length > MAX_SOURCE_CHARS) {
    throw new RangeError(`${label} source exceeds ${MAX_SOURCE_CHARS} characters.`);
  }
};

export const JAVASCRIPT_WORKER_BOOTSTRAP_PATH =
  "/playground-worker-bootstrap.mjs";
export const JAVASCRIPT_WORKER_COMPLETION_PATH =
  "/playground-worker-complete.mjs";

const JAVASCRIPT_WORKER_BRIDGE_KEY = "__devflowWorkerRuntimeV1__";

const runtimeModuleUrl = (runtimeOrigin, path) => {
  if (typeof runtimeOrigin !== "string") {
    throw new TypeError("Worker runtime origin must be a string.");
  }

  let origin;
  try {
    origin = new URL(runtimeOrigin);
  } catch {
    throw new TypeError("Worker runtime origin must be a valid URL.");
  }
  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    throw new TypeError("Worker runtime origin must use HTTP or HTTPS.");
  }

  return new URL(path, `${origin.origin}/`).href;
};

/**
 * Builds the disposable module Worker entry. Trusted runtime code is imported
 * from same-origin modules, so user declarations cannot share or rewrite its
 * lexical scope. Top-level await remains available without eval/new Function.
 */
export function buildJavaScriptWorkerSource(userSource, runtimeOrigin) {
  assertSource(userSource, "JavaScript");
  const sourceWithNewline = userSource.endsWith("\n")
    ? userSource
    : `${userSource}\n`;
  const bootstrapUrl = runtimeModuleUrl(
    runtimeOrigin,
    JAVASCRIPT_WORKER_BOOTSTRAP_PATH,
  );
  const completionUrl = runtimeModuleUrl(
    runtimeOrigin,
    JAVASCRIPT_WORKER_COMPLETION_PATH,
  );

  return `import ${JSON.stringify(bootstrapUrl)};
/* DEVFLOW_USER_MODULE_BEGIN */
${sourceWithNewline}/* DEVFLOW_USER_MODULE_END */
await import(${JSON.stringify(completionUrl)});
//# sourceURL=devflow-javascript-sandbox.mjs
`;
}

/** Canonical source for the checked-in same-origin bootstrap module asset. */
export function buildJavaScriptWorkerBootstrapModule() {
  return `const CHANNEL = ${JSON.stringify(SANDBOX_CHANNEL)};
const VERSION = ${SANDBOX_PROTOCOL_VERSION};
const MAX_LOGS = ${MAX_CONSOLE_ENTRIES};
const MAX_ARGS = ${MAX_CONSOLE_ARGUMENTS};
const MAX_VALUE = ${MAX_CONSOLE_VALUE_CHARS};
const BRIDGE_KEY = ${JSON.stringify(JAVASCRIPT_WORKER_BRIDGE_KEY)};
const formatValue = ${formatConsoleValue.toString()};
const normalizeError = ${normalizeRuntimeError.toString()};

await new Promise((runtimeReady) => {
  self.addEventListener("message", function startSandbox(event) {
    const data = event.data;
    const port = event.ports && event.ports[0];
    if (
      !data ||
      data.channel !== CHANNEL ||
      data.v !== VERSION ||
      data.type !== "start" ||
      typeof data.runId !== "string" ||
      !port
    ) return;

    self.removeEventListener("message", startSandbox);
    const runId = data.runId;
    const startedAt = performance.now();
    let sequence = 0;
    let terminal = false;
    let logCount = 0;
    let hasResult = false;
    let resultValue;

    const send = (payload) => {
      port.postMessage({
        channel: CHANNEL,
        v: VERSION,
        runId,
        source: "worker",
        seq: ++sequence,
        ...payload,
      });
    };
    const sendError = (error, phase) => {
      if (terminal) return;
      terminal = true;
      send({
        type: "runtime-error",
        phase,
        error: normalizeError(error),
        durationMs: Math.max(0, performance.now() - startedAt),
      });
    };

    const blocked = (name) => () => {
      throw new Error(name + " is disabled inside the DevFlow sandbox.");
    };
    const blockedAsync = (name) => () =>
      Promise.reject(new Error(name + " is disabled inside the DevFlow sandbox."));
    const replaceGlobal = (name, value) => {
      try {
        Object.defineProperty(self, name, {
          value,
          configurable: false,
          enumerable: false,
          writable: false,
        });
      } catch {
        try { self[name] = value; } catch {}
      }
    };

    replaceGlobal("fetch", blockedAsync("fetch"));
    replaceGlobal("WebSocket", blocked("WebSocket"));
    replaceGlobal("WebSocketStream", blocked("WebSocketStream"));
    replaceGlobal("EventSource", blocked("EventSource"));
    replaceGlobal("WebTransport", blocked("WebTransport"));
    replaceGlobal("XMLHttpRequest", blocked("XMLHttpRequest"));
    replaceGlobal("importScripts", blocked("importScripts"));
    replaceGlobal("Worker", blocked("Worker"));
    replaceGlobal("SharedWorker", blocked("SharedWorker"));
    replaceGlobal("BroadcastChannel", blocked("BroadcastChannel"));
    replaceGlobal("indexedDB", undefined);
    replaceGlobal("caches", undefined);
    replaceGlobal("cookieStore", undefined);
    replaceGlobal("postMessage", blocked("postMessage"));
    replaceGlobal("close", blocked("close"));
    replaceGlobal("sandboxResult", (value) => {
      if (!terminal) {
        hasResult = true;
        resultValue = value;
      }
      return value;
    });

    const sandboxConsole = {};
    for (const level of ["log", "info", "warn", "error"]) {
      Object.defineProperty(sandboxConsole, level, {
        configurable: false,
        enumerable: true,
        writable: false,
        value: (...values) => {
          if (terminal || logCount >= MAX_LOGS) return;
          if (logCount === MAX_LOGS - 1) {
            logCount += 1;
            send({
              type: "console",
              level: "warn",
              values: ["Console output stopped after " + (MAX_LOGS - 1) + " entries."],
            });
            return;
          }
          logCount += 1;
          send({
            type: "console",
            level,
            values: values
              .slice(0, MAX_ARGS)
              .map((value) => formatValue(value, { maxLength: MAX_VALUE })),
          });
        },
      });
    }
    replaceGlobal("console", Object.freeze(sandboxConsole));

    self.addEventListener("error", (errorEvent) => {
      errorEvent.preventDefault();
      const error =
        errorEvent.error ||
        new Error(errorEvent.message || "JavaScript execution failed.");
      sendError(error, error instanceof SyntaxError ? "compile" : "runtime");
    });
    self.addEventListener("unhandledrejection", (rejectionEvent) => {
      rejectionEvent.preventDefault();
      sendError(rejectionEvent.reason, "unhandled-rejection");
    });

    Object.defineProperty(self, BRIDGE_KEY, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        complete() {
          if (terminal) return;
          terminal = true;
          send({
            type: "result",
            value: formatValue(hasResult ? resultValue : undefined, {
              maxLength: MAX_VALUE,
            }),
            durationMs: Math.max(0, performance.now() - startedAt),
          });
        },
      }),
    });

    send({ type: "started" });
    runtimeReady();
  });
});
//# sourceURL=devflow-worker-bootstrap.mjs
`;
}

/** Canonical source for the checked-in completion module asset. */
export function buildJavaScriptWorkerCompletionModule() {
  return `const bridge = globalThis[${JSON.stringify(JAVASCRIPT_WORKER_BRIDGE_KEY)}];
if (!bridge || typeof bridge.complete !== "function") {
  throw new Error("DevFlow Worker completion bridge is unavailable.");
}
bridge.complete();
//# sourceURL=devflow-worker-complete.mjs
`;
}

/**
 * Returns a fixed preview bootstrap. User HTML/CSS/JS is transferred later via
 * MessageChannel and applied with DOM APIs, so closing tags never enter srcdoc.
 */
export function buildHtmlPreviewDocument() {
  const bootstrap = `(() => {
  "use strict";
  const CHANNEL = ${JSON.stringify(SANDBOX_CHANNEL)};
  const VERSION = ${SANDBOX_PROTOCOL_VERSION};
  const MAX_SOURCE = ${MAX_SOURCE_CHARS};
  const MAX_LOGS = ${MAX_CONSOLE_ENTRIES};
  const MAX_ARGS = ${MAX_CONSOLE_ARGUMENTS};
  const MAX_VALUE = ${MAX_CONSOLE_VALUE_CHARS};
  const formatValue = ${formatConsoleValue.toString()};
  const normalizeError = ${normalizeRuntimeError.toString()};

  window.addEventListener("message", function startSandbox(event) {
    const data = event.data;
    const port = event.ports && event.ports[0];
    const files = data && data.files;
    if (
      !data ||
      data.channel !== CHANNEL ||
      data.v !== VERSION ||
      data.type !== "start" ||
      typeof data.runId !== "string" ||
      !files ||
      typeof files.html !== "string" ||
      typeof files.css !== "string" ||
      typeof files.javascript !== "string" ||
      files.html.length > MAX_SOURCE ||
      files.css.length > MAX_SOURCE ||
      files.javascript.length > MAX_SOURCE ||
      !port
    ) return;

    window.removeEventListener("message", startSandbox);
    const runId = data.runId;
    const startedAt = performance.now();
    let sequence = 0;
    let completed = false;
    let terminal = false;
    let logCount = 0;

    const send = (payload) => {
      port.postMessage({
        channel: CHANNEL,
        v: VERSION,
        runId,
        source: "iframe",
        seq: ++sequence,
        ...payload,
      });
    };
    const sendError = (error, phase) => {
      if (terminal) return;
      terminal = true;
      send({
        type: "runtime-error",
        phase,
        error: normalizeError(error),
        durationMs: Math.max(0, performance.now() - startedAt),
      });
    };

    const blocked = (name) => () => {
      throw new Error(name + " is disabled inside the DevFlow preview.");
    };
    const blockedAsync = (name) => () =>
      Promise.reject(new Error(name + " is disabled inside the DevFlow preview."));
    const replaceGlobal = (name, value) => {
      try {
        Object.defineProperty(window, name, {
          value,
          configurable: false,
          enumerable: false,
          writable: false,
        });
      } catch {
        try { window[name] = value; } catch {}
      }
    };

    replaceGlobal("fetch", blockedAsync("fetch"));
    replaceGlobal("WebSocket", blocked("WebSocket"));
    replaceGlobal("EventSource", blocked("EventSource"));
    replaceGlobal("XMLHttpRequest", blocked("XMLHttpRequest"));
    replaceGlobal("Worker", blocked("Worker"));
    replaceGlobal("SharedWorker", blocked("SharedWorker"));
    replaceGlobal("BroadcastChannel", blocked("BroadcastChannel"));
    replaceGlobal("indexedDB", undefined);
    replaceGlobal("caches", undefined);

    for (const level of ["log", "info", "warn", "error"]) {
      console[level] = (...values) => {
        if (terminal || logCount >= MAX_LOGS) return;
        if (logCount === MAX_LOGS - 1) {
          logCount += 1;
          send({
            type: "console",
            level: "warn",
            values: ["Console output stopped after " + (MAX_LOGS - 1) + " entries."],
          });
          return;
        }
        logCount += 1;
        send({
          type: "console",
          level,
          values: values
            .slice(0, MAX_ARGS)
            .map((value) => formatValue(value, { maxLength: MAX_VALUE })),
        });
      };
    }

    window.addEventListener("error", (errorEvent) => {
      errorEvent.preventDefault();
      const error = errorEvent.error || new Error(errorEvent.message || "Preview script failed.");
      sendError(error, error instanceof SyntaxError ? "compile" : "runtime");
    });
    window.addEventListener("unhandledrejection", (rejectionEvent) => {
      rejectionEvent.preventDefault();
      sendError(rejectionEvent.reason, "unhandled-rejection");
    });

    send({ type: "started" });

    try {
      document.getElementById("devflow-preview-style").textContent = files.css;
      document.getElementById("devflow-preview-root").innerHTML = files.html;

      const bridgeKey = "__devflowBridge_" + Math.random().toString(36).slice(2);
      Object.defineProperty(window, bridgeKey, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({
          resolve(value) {
            if (terminal || completed) return;
            completed = true;
            send({
              type: "result",
              value: formatValue(value, { maxLength: MAX_VALUE }),
              durationMs: Math.max(0, performance.now() - startedAt),
            });
          },
          reject(error) {
            sendError(error, error instanceof SyntaxError ? "compile" : "runtime");
          },
        }),
      });

      const script = document.createElement("script");
      script.textContent =
        'void (async () => {\\ntry {\\nconst __devflowResult = await (async () => {\\n' +
        files.javascript +
        '\\n})();\\nwindow[' + JSON.stringify(bridgeKey) + '].resolve(__devflowResult);\\n' +
        '} catch (__devflowError) { window[' + JSON.stringify(bridgeKey) +
        '].reject(__devflowError); }\\n})();\\n//# sourceURL=devflow-html-preview.js\\n';
      document.body.append(script);
    } catch (error) {
      sendError(error, error instanceof SyntaxError ? "compile" : "runtime");
    }
  });
})();`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
  <title>DevFlow isolated preview</title>
  <style id="devflow-preview-style"></style>
</head>
<body>
  <div id="devflow-preview-root"></div>
  <script>${bootstrap}</script>
</body>
</html>`;
}
