import { defineConfig, devices } from "@playwright/test";

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
  use: {
    baseURL: "http://localhost:3103",
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
  webServer: {
    command: isProductionMode
      ? "npm exec next start -- -p 3103"
      : "npm exec next dev -- -p 3103",
    url: "http://localhost:3103/auth/admin/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "http://booking-history-fixture.local",
    },
  },
});
