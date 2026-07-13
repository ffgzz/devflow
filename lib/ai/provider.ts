import "server-only";

import { RequestError } from "@/lib/http-errors";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const envValue = (name: string) => process.env[name]?.trim() || undefined;

export const positiveIntegerFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

const apiKey = envValue("AI_API_KEY") ?? envValue("MINIMAX_API_KEY");
const provider = createOpenAICompatible({
  name: "devflow-ai",
  baseURL:
    envValue("AI_BASE_URL") ??
    envValue("MINIMAX_BASE_URL") ??
    "https://api.deepseek.com",
  apiKey,
  // Most OpenAI-compatible providers support JSON mode but not strict JSON
  // Schema. Deployments that do support it can explicitly opt in.
  supportsStructuredOutputs:
    envValue("AI_SUPPORTS_STRUCTURED_OUTPUTS") === "true",
});

export function getAIModel() {
  if (!apiKey) {
    throw new RequestError(503, "AI service is not configured.");
  }

  return provider.chatModel(envValue("AI_MODEL") ?? "deepseek-v4-flash");
}

export const getAIRequestSettings = (defaultMaxOutputTokens: number) => ({
  maxOutputTokens: positiveIntegerFromEnv(
    "AI_MAX_OUTPUT_TOKENS",
    defaultMaxOutputTokens,
  ),
  timeoutMs: positiveIntegerFromEnv("AI_REQUEST_TIMEOUT_MS", 30_000),
});
