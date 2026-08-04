import { defineConfig, devices } from "@playwright/test";
import { createIsolatedNextWebServer } from "./playwright.next-server";

const isProductionMode = process.env.HB06_TEST_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/historical-booking",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "playwright-report/historical-booking", open: "never" },
    ],
  ],
  outputDir: "test-results/historical-booking",
  use: {
    baseURL: "http://localhost:3103",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: createIsolatedNextWebServer("historicalBooking", isProductionMode),
});
