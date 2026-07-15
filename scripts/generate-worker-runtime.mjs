import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildJavaScriptWorkerBootstrapModule,
  buildJavaScriptWorkerCompletionModule,
} from "../lib/playground/sandbox-runtime.mjs";

const bootstrapPath = fileURLToPath(
  new URL("../public/playground-worker-bootstrap.mjs", import.meta.url),
);
const completionPath = fileURLToPath(
  new URL("../public/playground-worker-complete.mjs", import.meta.url),
);

await Promise.all([
  writeFile(bootstrapPath, buildJavaScriptWorkerBootstrapModule(), "utf8"),
  writeFile(completionPath, buildJavaScriptWorkerCompletionModule(), "utf8"),
]);

process.stdout.write("Generated the trusted Code Lab Worker modules.\n");
