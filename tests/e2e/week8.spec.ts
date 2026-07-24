import { expect, test } from "@playwright/test";

test("runs the starter JavaScript in the isolated Code Lab worker", async ({
  page,
}) => {
  await page.goto("/playground");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Run frontend code without leaving DevFlow",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Run/u }).click();

  const sandboxConsole = page.locator('[aria-label="Sandbox console"]');
  await expect(sandboxConsole).toContainText("Completed", { timeout: 10_000 });
  await expect(sandboxConsole).toContainText("Qualified developers:");
  await expect(sandboxConsole).toContainText("Returned:");
});

test("opens the command search, navigates results, and follows Enter", async ({
  page,
}) => {
  await page.route("**/api/search?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          query,
          type: null,
          items: [
            {
              id: "question-react",
              type: "question",
              title: "React rendering model",
              subtitle: "Question",
              href: "/playground?selected=question",
            },
            {
              id: "tag-react",
              type: "tag",
              title: "React",
              subtitle: "12 questions",
              href: "/playground?selected=tag",
            },
          ],
        },
      }),
    });
  });

  await page.goto("/playground");
  const search = page.getByRole("combobox", { name: "Global search" });

  // A server-rendered input can be visible before its client event handlers are
  // hydrated. Open and close it once as a deterministic hydration handshake.
  await search.click();
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await search.press("Escape");
  await expect(search).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("Control+K");
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute("aria-expanded", "true");

  await search.fill("react");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.first()).toHaveAttribute("aria-selected", "true");

  await search.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");

  await expect(page).toHaveURL(/\/playground\?selected=tag$/u);
});

test("rejects invalid search and feed parameters before database access", async ({
  request,
}) => {
  const searchResponse = await request.get("/api/search?q=x");
  expect(searchResponse.status()).toBe(400);
  expect(searchResponse.headers()["cache-control"]).toContain("private");
  expect(searchResponse.headers()["cache-control"]).toContain("no-store");
  await expect(searchResponse.json()).resolves.toMatchObject({
    success: false,
    error: {
      message: "Enter 2 to 100 characters and choose a valid type.",
    },
  });

  const feedResponse = await request.get(
    "/api/questions/feed?filter=unsupported&limit=200",
  );
  expect(feedResponse.status()).toBe(400);
  expect(feedResponse.headers()["cache-control"]).toContain("private");
  expect(feedResponse.headers()["cache-control"]).toContain("no-store");
  await expect(feedResponse.json()).resolves.toMatchObject({
    success: false,
    errors: { message: "Invalid feed query." },
  });
});
