/* eslint-disable @typescript-eslint/no-require-imports -- LHCI loads this config through CommonJS. */
const { chromium } = require("@playwright/test");

const baseUrl = process.env.LHCI_BASE_URL ?? "http://127.0.0.1:3100";
const includeDatabaseRoutes =
  process.env.LHCI_INCLUDE_DATABASE_ROUTES === "true";

const paths = includeDatabaseRoutes
  ? ["/", "/playground"]
  : ["/playground"];

module.exports = {
  ci: {
    collect: {
      chromePath: process.env.CHROME_PATH ?? chromium.executablePath(),
      startServerCommand: "pnpm start --port 3100 --hostname 127.0.0.1",
      startServerReadyPattern: "Ready",
      startServerReadyTimeout: 60_000,
      numberOfRuns: 1,
      url: paths.map((path) => new URL(path, baseUrl).toString()),
      puppeteerLaunchOptions: {
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
        headless: true,
      },
      settings: {
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.75 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "total-byte-weight": ["error", { maxNumericValue: 1_800_000 }],
        "unused-javascript": ["warn", { maxNumericValue: 450_000 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
