import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration specifically for the Kaza Booking Client Portal Smoke Tests.
 */
export default defineConfig({
  testDir: "./tests/client-smoke",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report/client-smoke" }],
    ["list"],
  ],
  outputDir: "test-results/client-smoke",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
