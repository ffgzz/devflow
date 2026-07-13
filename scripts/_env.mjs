import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

export function loadProjectEnv() {
  const mode = process.env.NODE_ENV || "development";
  const candidates = [
    `.env.${mode}.local`,
    ...(mode === "test" ? [] : [".env.local"]),
    `.env.${mode}`,
    ".env",
  ];

  for (const candidate of candidates) {
    const path = resolve(process.cwd(), candidate);

    if (existsSync(path)) {
      const higherPriorityEnvironment = { ...process.env };
      loadEnvFile(path);
      Object.assign(process.env, higherPriorityEnvironment);
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and set it locally.`,
    );
  }

  return value;
}

export function safeErrorMessage(error) {
  let message = error instanceof Error ? error.message : "Unknown error";

  const secrets = [process.env.MONGODB_URI, process.env.DEMO_USER_PASSWORD];
  for (const secret of secrets) {
    if (secret) {
      message = message.replaceAll(secret, "[redacted]");
    }
  }

  return message.replace(
    /mongodb(?:\+srv)?:\/\/[^\s'"]+/giu,
    "[redacted MongoDB URI]",
  );
}
