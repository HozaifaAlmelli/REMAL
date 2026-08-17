import assert from "node:assert/strict";
import test from "node:test";

import adminConfig from "../../playwright.admin.config";
import bookingHistoryConfig from "../../playwright.booking-history.config";
import clientConfig from "../../playwright.client.config";
import crmConfig from "../../playwright.crm.config";
import historicalBookingConfig from "../../playwright.historical-booking.config";
import historicalReportingConfig from "../../playwright.historical-reporting.config";
import occupancyConfig from "../../playwright.occupancy.config";
import ownerConfig from "../../playwright.owner.config";
import {
  playwrightNextSuites,
  type PlaywrightNextSuite,
} from "../../playwright.next-server";

const selfHostedConfigs = {
  crm: crmConfig,
  historicalBooking: historicalBookingConfig,
  bookingHistory: bookingHistoryConfig,
  historicalReporting: historicalReportingConfig,
  occupancy: occupancyConfig,
} satisfies Record<PlaywrightNextSuite, typeof crmConfig>;

const allConfigs = [
  adminConfig,
  bookingHistoryConfig,
  clientConfig,
  crmConfig,
  historicalBookingConfig,
  historicalReportingConfig,
  occupancyConfig,
  ownerConfig,
];

test("self-hosted Playwright suites own unique ports, fixture hosts and distDirs", () => {
  const definitions = Object.values(playwrightNextSuites);

  assert.equal(
    new Set(definitions.map(({ port }) => port)).size,
    definitions.length
  );
  assert.equal(
    new Set(definitions.map(({ apiUrl }) => apiUrl)).size,
    definitions.length
  );
  assert.equal(
    new Set(definitions.map(({ distDir }) => distDir)).size,
    definitions.length
  );

  for (const definition of definitions) {
    assert.match(definition.distDir, /^\.next-playwright-[a-z0-9-]+$/);
    assert.notEqual(definition.distDir, ".next");
  }
});

test("each self-hosted config passes only its own fixture environment to Next", () => {
  for (const [suite, config] of Object.entries(selfHostedConfigs) as Array<
    [PlaywrightNextSuite, typeof crmConfig]
  >) {
    const definition = playwrightNextSuites[suite];
    const webServer = Array.isArray(config.webServer)
      ? config.webServer[0]
      : config.webServer;

    assert.ok(webServer);
    assert.equal(webServer.reuseExistingServer, false);
    assert.match(webServer.command, new RegExp(`-p ${definition.port}$`));
    assert.equal(webServer.env?.NEXT_PUBLIC_API_URL, definition.apiUrl);
    assert.equal(webServer.env?.PLAYWRIGHT_NEXT_DIST_DIR, definition.distDir);
    assert.equal(config.use?.baseURL, `http://localhost:${definition.port}`);
  }
});

test("every Playwright config owns a private result directory", () => {
  const outputDirs = allConfigs.map(({ outputDir }) => outputDir);

  assert.ok(outputDirs.every(Boolean));
  assert.equal(new Set(outputDirs).size, allConfigs.length);
  assert.ok(
    outputDirs.every((outputDir) => outputDir?.startsWith("test-results/"))
  );
});

test("externally hosted smoke suites do not launch or rebuild Next", () => {
  for (const config of [adminConfig, clientConfig, ownerConfig]) {
    assert.equal(config.webServer, undefined);
    assert.equal(config.use?.baseURL, "http://localhost:3001");
  }
});

async function loadNextConfig(distDir: string | undefined) {
  const previous = process.env.PLAYWRIGHT_NEXT_DIST_DIR;
  if (distDir === undefined) {
    delete process.env.PLAYWRIGHT_NEXT_DIST_DIR;
  } else {
    process.env.PLAYWRIGHT_NEXT_DIST_DIR = distDir;
  }

  try {
    const module = await import(
      `../../next.config.mjs?isolation=${encodeURIComponent(distDir ?? "default")}`
    );
    return module.default as { distDir?: string };
  } finally {
    if (previous === undefined) {
      delete process.env.PLAYWRIGHT_NEXT_DIST_DIR;
    } else {
      process.env.PLAYWRIGHT_NEXT_DIST_DIR = previous;
    }
  }
}

test("normal Next builds retain the default .next directory", async () => {
  const config = await loadNextConfig(undefined);
  assert.equal(config.distDir, undefined);
});

test("Next accepts every repository-owned private Playwright directory", async () => {
  for (const { distDir } of Object.values(playwrightNextSuites)) {
    const config = await loadNextConfig(distDir);
    assert.equal(config.distDir, distDir);
  }
});

test("Next rejects traversal, absolute and non-Playwright build directories", async () => {
  for (const invalid of [
    ".next",
    "../.next-playwright-crm",
    ".next-playwright/other",
    "C:\\temp\\.next-playwright-crm",
    ".next-playwright-CRM",
  ]) {
    await assert.rejects(
      loadNextConfig(invalid),
      /PLAYWRIGHT_NEXT_DIST_DIR must use/
    );
  }
});
