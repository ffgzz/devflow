// @vitest-environment node

import {
  createErrorFingerprint,
  sanitizeErrorName,
  sanitizePathname,
} from "@/lib/observability/shared";
import { describe, expect, it } from "vitest";

describe("privacy-bounded observability projection", () => {
  it("drops query data and masks identifier-shaped path segments", () => {
    expect(
      sanitizePathname(
        "/questions/507f1f77bcf86cd799439011?email=user@example.com#answer",
      ),
    ).toBe("/questions/:id");
    expect(sanitizePathname("/profile/12345")).toBe("/profile/:id");
  });

  it("keeps useful error categories but rejects free-form names", () => {
    expect(sanitizeErrorName(" TypeError ")).toBe("TypeError");
    expect(sanitizeErrorName("user@example.com")).toBe("UnknownError");
    expect(sanitizeErrorName({ message: "secret" })).toBe("UnknownError");
  });

  it("creates a stable grouping key without storing messages or stacks", () => {
    const first = createErrorFingerprint([
      "react-boundary",
      "TypeError",
      "/questions/:id",
    ]);
    const second = createErrorFingerprint([
      "react-boundary",
      "TypeError",
      "/questions/:id",
    ]);

    expect(first).toBe(second);
    expect(first).toMatch(/^fnv1a-[a-f\d]{8}$/u);
  });
});
