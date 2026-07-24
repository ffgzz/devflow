import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "pnpm start --port 3100 --hostname 127.0.0.1",
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        env: {
          MONGODB_URI:
            process.env.MONGODB_URI ??
            "mongodb://127.0.0.1:27017/devflow-playwright",
          AUTH_SECRET:
            process.env.AUTH_SECRET ??
            "playwright-only-secret-that-is-never-used-in-production",
          AUTH_TRUST_HOST: "true",
          AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID ?? "playwright-github-id",
          AUTH_GITHUB_SECRET:
            process.env.AUTH_GITHUB_SECRET ?? "playwright-github-secret",
          AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? "playwright-google-id",
          AUTH_GOOGLE_SECRET:
            process.env.AUTH_GOOGLE_SECRET ?? "playwright-google-secret",
        },
      },
});
