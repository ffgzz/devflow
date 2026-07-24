// @vitest-environment node

import {
  createStarterProject,
  createTemplateFiles,
} from "@/lib/playground/templates";
import { describe, expect, it } from "vitest";

describe("playground templates", () => {
  it("creates a runnable JavaScript starter workspace", () => {
    const project = createStarterProject();

    expect(project.mode).toBe("javascript");
    expect(project.name).toBe("JavaScript Starter");
    expect(project.files.javascript).toContain("sandboxResult");
    expect(project.id).toBeTruthy();
  });

  it("returns independent file objects for separate workspaces", () => {
    const first = createTemplateFiles("web");
    const second = createTemplateFiles("web");

    first.html = "changed locally";

    expect(second.html).toContain("DEVFLOW CODE LAB");
    expect(second.html).not.toBe(first.html);
  });

  it("rejects an unknown runtime mode at the boundary", () => {
    expect(() => createTemplateFiles("python" as never)).toThrow(
      "Unknown playground mode.",
    );
  });
});
