export const playwrightNextSuites = {
  crm: {
    port: 3102,
    distDir: ".next-playwright-crm",
    apiUrl: "http://crm-fixture.local",
  },
  historicalBooking: {
    port: 3103,
    distDir: ".next-playwright-historical-booking",
    apiUrl: "http://historical-fixture.local",
  },
  bookingHistory: {
    port: 3104,
    distDir: ".next-playwright-booking-history",
    apiUrl: "http://booking-history-fixture.local",
  },
  historicalReporting: {
    port: 3105,
    distDir: ".next-playwright-historical-reporting",
    apiUrl: "http://historical-reporting-fixture.local",
  },
  occupancy: {
    port: 3106,
    distDir: ".next-playwright-occupancy",
    apiUrl: "http://occupancy-fixture.local",
  },
} as const;

export type PlaywrightNextSuite = keyof typeof playwrightNextSuites;

export function createIsolatedNextWebServer(
  suite: PlaywrightNextSuite,
  productionMode: boolean
) {
  const definition = playwrightNextSuites[suite];

  return {
    command: productionMode
      ? `npm exec next start -- -p ${definition.port}`
      : `npm exec next dev -- -p ${definition.port}`,
    url: `http://localhost:${definition.port}/auth/admin/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: definition.apiUrl,
      PLAYWRIGHT_NEXT_DIST_DIR: definition.distDir,
    },
  };
}
