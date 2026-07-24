// @vitest-environment node

import { translate } from "@/lib/i18n/config";
import { describe, expect, it } from "vitest";

describe("DevFlow translations", () => {
  it("uses natural Chinese product copy and keeps the English source available", () => {
    expect(translate("zh-CN", "Ask a Question")).toBe("发布问题");
    expect(translate("en", "Ask a Question")).toBe("Ask a Question");
  });

  it("interpolates UI values without translating technical names", () => {
    expect(
      translate("zh-CN", "Remove {name} tag", { name: "React" }),
    ).toBe("移除 React 标签");
    expect(translate("zh-CN", "React")).toBe("React");
  });

  it("localizes dynamic recommendation reasons while preserving tag data", () => {
    expect(
      translate("zh-CN", "Because you saved questions about TypeScript"),
    ).toBe("因为你收藏过与 TypeScript 相关的问题");
  });
});
