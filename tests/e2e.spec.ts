import { test, expect } from "@playwright/test";
test("searches, traverses connected records, and saves a work item", async ({
  page,
}) => {
  await page.goto("/demo/work-items");
  await page.getByLabel("Search work items and pull requests").fill("ENG-138");
  await expect(page.getByText("Showing 1–1 of 1 work items")).toBeVisible();
  await page
    .getByRole("button", {
      name: "ENG-138 Fix OAuth token refresh race condition",
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Connected development");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /devsync\/api · #246/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Pull request #246");
  await expect(page.getByRole("dialog")).toContainText("Failing");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Search work items and pull requests").fill("");
  await page
    .getByRole("button", { name: "Show bookmarked work items" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "ENG-138 Fix OAuth token refresh race condition",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "ENG-142 Add workspace-level permissions",
    }),
  ).toHaveCount(0);
});
test("filters pull requests and opens evidence with provenance", async ({
  page,
}) => {
  await page.goto("/demo/pull-requests");
  // Reselect until applied: a change made before hydration is not replayed.
  await expect(async () => {
    await page.getByLabel("Filter by check result").selectOption("failing");
    await expect(
      page.getByRole("button", { name: /ENG-142 Add workspace/ }),
    ).toHaveCount(0, { timeout: 1000 });
  }).toPass();
  await expect(
    page.getByRole("button", { name: /ENG-138 Fix OAuth/ }),
  ).toBeVisible();
  await page.goto("/demo/evidence");
  await page
    .getByRole("button", { name: "Needs attention 1", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Checks need attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Missing a Jira link" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /Checks need attention ENG-138/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("ENG-138");
});
test("mobile navigation works without document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Your delivery, connected." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Connections", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Connections" }),
  ).toBeVisible();
  await expect(page.getByText("Sample connection")).toHaveCount(2);
});
