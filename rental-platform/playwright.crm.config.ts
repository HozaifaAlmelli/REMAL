import { defineConfig, devices } from "@playwright/test";
import { createIsolatedNextWebServer } from "./playwright.next-server";

const isProductionMode = process.env.CRM_TEST_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/crm-ui",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/crm-ui", open: "never" }],
  ],
  outputDir: "test-results/crm-ui",
  use: {
    baseURL: "http://localhost:3102",
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
  webServer: createIsolatedNextWebServer("crm", isProductionMode),
});
