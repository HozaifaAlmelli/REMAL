import { defineConfig, devices } from "@playwright/test";

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
  webServer: {
    command: isProductionMode
      ? "npm exec next start -- -p 3102"
      : "npm exec next dev -- -p 3102",
    url: "http://localhost:3102/auth/admin/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "http://crm-fixture.local",
    },
  },
});
