import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GlobalSearch from "@/components/search/GlobalSearch";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/playground",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

vi.mock("next/image", () => ({
  default: ({ src }: { src: string }) => (
    <span aria-hidden="true" data-image-src={src} />
  ),
}));

const successfulSearch = {
  success: true,
  data: {
    query: "react",
    type: null,
    items: [
      {
        id: "question-1",
        type: "question",
        title: "React rendering model",
        subtitle: "Question",
        href: "/questions/react-rendering",
      },
      {
        id: "tag-1",
        type: "tag",
        title: "React",
        subtitle: "12 questions",
        href: "/tags/react",
      },
    ],
  },
};

describe("GlobalSearch", () => {
  beforeEach(() => {
    navigation.push.mockReset();
  });

  it("opens and focuses with Ctrl+K, then closes with Escape", () => {
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox", { name: "Global search" });

    expect(input.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText("Type at least 2 characters to search."),
    ).toBeDefined();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).not.toBe(input);
  });

  it("debounces the API request and supports keyboard result selection", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue({
        ok: true,
        json: async () => successfulSearch,
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<GlobalSearch />);
    const input = screen.getByRole("combobox", { name: "Global search" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "react" } });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/search?q=react");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(navigation.push).toHaveBeenCalledWith("/tags/react");

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("cancels the first debounce when the query changes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue({
        ok: true,
        json: async () => successfulSearch,
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<GlobalSearch />);
    const input = screen.getByRole("combobox", { name: "Global search" });

    fireEvent.change(input, { target: { value: "react" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    fireEvent.change(input, { target: { value: "next" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/search?q=next");

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
