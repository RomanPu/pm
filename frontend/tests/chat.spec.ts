import { expect, test } from "@playwright/test";
import { initialData } from "../src/lib/kanban";
import { signInWithFreshBoard } from "./helpers";

// /api/chat is intercepted so these tests do not call the real AI

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
  await page.getByRole("button", { name: /ask ai/i }).click();
});

test("chat reply updates the board without a reload", async ({ page }) => {
  const board = structuredClone(initialData);
  board.cards["card-ai"] = { id: "card-ai", title: "Added by AI", details: "" };
  board.columns[3].cardIds.push("card-ai");
  let sentBody: unknown;
  await page.route("/api/chat", async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({ json: { reply: "Added it to Review.", board_updated: true, board } });
  });

  const sidebar = page.getByRole("complementary", { name: "AI assistant" });
  await sidebar.getByLabel("Message").fill("Add a card to Review");
  await sidebar.getByRole("button", { name: /send/i }).click();

  await expect(sidebar.getByText("Added it to Review.")).toBeVisible();
  await expect(page.getByTestId("column-col-review").getByText("Added by AI")).toBeVisible();
  expect(sentBody).toEqual({ message: "Add a card to Review", history: [] });
});

test("chat shows an error when the AI is unavailable", async ({ page }) => {
  await page.route("/api/chat", (route) =>
    route.fulfill({ status: 503, json: { detail: "The AI is unavailable right now." } })
  );

  const sidebar = page.getByRole("complementary", { name: "AI assistant" });
  await sidebar.getByLabel("Message").fill("Hello");
  await sidebar.getByRole("button", { name: /send/i }).click();

  await expect(sidebar.getByText(/ai is unavailable/i)).toBeVisible();
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(8);
});

test("sidebar can be closed and reopened", async ({ page }) => {
  await expect(page.getByRole("complementary", { name: "AI assistant" })).toBeVisible();
  await page.getByRole("button", { name: /close assistant/i }).click();
  await expect(page.getByRole("complementary", { name: "AI assistant" })).toHaveCount(0);
  await page.getByRole("button", { name: /ask ai/i }).click();
  await expect(page.getByRole("complementary", { name: "AI assistant" })).toBeVisible();
});
