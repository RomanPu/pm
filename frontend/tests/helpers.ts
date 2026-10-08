import { expect, type Page } from "@playwright/test";
import { initialData } from "../src/lib/kanban";

export const signIn = async (page: Page, password = "password") => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
};

export const signInToBoard = async (page: Page) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

// Signs in and resets the user's saved board to the demo data, so tests start clean.
// Note: this overwrites the board stored in the container's database.
export const signInWithFreshBoard = async (page: Page) => {
  await page.request.post("/api/login", { data: { username: "user", password: "password" } });
  const response = await page.request.put("/api/board", { data: initialData });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};
