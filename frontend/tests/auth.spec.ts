import { expect, test } from "@playwright/test";
import { signIn, signInToBoard } from "./helpers";

test("shows the login form when not signed in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
});

test("rejects a wrong password", async ({ page }) => {
  await signIn(page, "wrong");
  await expect(page.getByText(/invalid username or password/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
});

test("signs in, stays signed in on reload, and logs out", async ({ page }) => {
  await signInToBoard(page);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("board API is protected without a session", async ({ request }) => {
  const response = await request.get("/api/me");
  expect(response.status()).toBe(401);
});
