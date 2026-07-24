import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

if (
  typeof HTMLElement !== "undefined" &&
  !HTMLElement.prototype.scrollIntoView
) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}
