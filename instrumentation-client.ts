import { installGlobalErrorHandlers } from "@/lib/observability/client";

try {
  installGlobalErrorHandlers();
} catch {
  // Instrumentation failures must never prevent hydration.
}
