import { expect, test } from "@playwright/test";
import { signInToBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInToBoard(page);
});

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("edits a card", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: /edit align roadmap themes/i }).click();
  await card.getByLabel("Edit title").fill("Edited in e2e");
  await card.getByLabel("Edit details").fill("New details.");
  await card.getByRole("button", { name: /save/i }).click();
  await expect(card.getByText("Edited in e2e")).toBeVisible();
  await expect(card.getByText("New details.")).toBeVisible();
});

test("removes a card", async ({ page }) => {
  await page.getByRole("button", { name: "Delete Align roadmap themes", exact: true }).click();
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);
});

test("renames a column", async ({ page }) => {
  const input = page.getByTestId("column-col-backlog").getByLabel("Column title");
  await input.fill("Ideas");
  await expect(input).toHaveValue("Ideas");
  await expect(page.locator("header").getByText("Ideas")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});
