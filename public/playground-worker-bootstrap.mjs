const CHANNEL = "devflow:sandbox";
const VERSION = 1;
const MAX_LOGS = 200;
const MAX_ARGS = 12;
const MAX_VALUE = 4000;
const BRIDGE_KEY = "__devflowWorkerRuntimeV1__";
const formatValue = function formatConsoleValue(value, options = {}) {
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
};
const normalizeError = function normalizeRuntimeError(error) {
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
};

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
