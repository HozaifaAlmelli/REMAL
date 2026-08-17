import { defineConfig, devices } from "@playwright/test";
import { createIsolatedNextWebServer } from "./playwright.next-server";

const isProductionMode = process.env.HB08A3_TEST_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/historical-reporting",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "playwright-report/historical-reporting", open: "never" },
    ],
  ],
  outputDir: "test-results/historical-reporting",
  use: {
    baseURL: "http://localhost:3105",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: createIsolatedNextWebServer(
    "historicalReporting",
    isProductionMode
  ),
});
