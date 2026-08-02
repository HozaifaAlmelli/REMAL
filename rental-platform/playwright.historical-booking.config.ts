import { defineConfig, devices } from "@playwright/test";

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
  webServer: {
    command: isProductionMode
      ? "npm exec next start -- -p 3103"
      : "npm exec next dev -- -p 3103",
    url: "http://localhost:3103/auth/admin/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "http://historical-fixture.local",
    },
  },
});
