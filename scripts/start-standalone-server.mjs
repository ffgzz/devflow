import { access, cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = join(projectRoot, ".next", "standalone");
const serverPath = join(standaloneRoot, "server.js");
const args = process.argv.slice(2);

// Unlike `next start`, the generated standalone server expects its runtime
// environment to be prepared by the host. Loading the conventional `.env*`
// files here keeps `pnpm start` useful locally while explicit deployment
// variables still win according to Next.js' documented load order.
process.env.NODE_ENV ??= "production";
loadEnvConfig(projectRoot);

const argumentValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

try {
  await access(serverPath);
} catch {
  throw new Error(
    "The standalone server needs a production build. Run `pnpm build` first.",
  );
}

// Standalone output intentionally omits CDN-served assets. A self-hosted Node
// server serves them itself, so place public and generated static assets beside
// server.js before booting. The operation is repeatable and safe for E2E runs.
await mkdir(join(standaloneRoot, ".next"), { recursive: true });
await Promise.all([
  cp(join(projectRoot, "public"), join(standaloneRoot, "public"), {
    recursive: true,
    force: true,
  }),
  cp(
    join(projectRoot, ".next", "static"),
    join(standaloneRoot, ".next", "static"),
    {
      recursive: true,
      force: true,
    },
  ),
]);

process.env.PORT ??= argumentValue("--port") ?? "3000";
process.env.HOSTNAME ??= argumentValue("--hostname") ?? "127.0.0.1";

// Auth.js must know the trusted public origin in production. Deployments should
// set AUTH_URL explicitly; the canonical app URL is a safe fallback, and a
// loopback-only local server can derive its own origin without trusting
// arbitrary Host headers.
if (!process.env.AUTH_URL && process.env.NEXT_PUBLIC_APP_URL) {
  process.env.AUTH_URL = process.env.NEXT_PUBLIC_APP_URL;
}
if (
  !process.env.AUTH_URL &&
  ["127.0.0.1", "localhost", "::1"].includes(process.env.HOSTNAME)
) {
  const host = process.env.HOSTNAME === "::1" ? "[::1]" : process.env.HOSTNAME;
  process.env.AUTH_URL = `http://${host}:${process.env.PORT}`;
}

await import(pathToFileURL(serverPath).href);
