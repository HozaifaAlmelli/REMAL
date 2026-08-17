import { defineConfig, devices } from "@playwright/test";
import { createIsolatedNextWebServer } from "./playwright.next-server";

const isProductionMode = process.env.BOOKING_HISTORY_TEST_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/booking-history",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "playwright-report/booking-history",
        open: "never",
      },
    ],
  ],
  outputDir: "test-results/booking-history",
  use: {
    baseURL: "http://localhost:3104",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: createIsolatedNextWebServer("bookingHistory", isProductionMode),
});
