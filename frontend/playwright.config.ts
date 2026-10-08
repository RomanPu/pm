import { defineConfig, devices } from "@playwright/test";

// E2E tests need the backend, so they run against the Docker container
// (start it with scripts/start.ps1 or scripts/start.sh first).
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  // Tests share one user and board in the database, so run them one at a time
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
