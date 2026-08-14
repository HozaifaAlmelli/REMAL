import { expect, test, type Page, type Route } from "@playwright/test";

const cors = {
  "access-control-allow-origin": "http://localhost:3106",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

type UnavailableReason =
  | "coverage_incomplete"
  | "zero_capacity"
  | "integrity_conflict";

interface OccupancyResponse {
  from: string;
  toExclusive: string;
  occupiedUnitNights: number;
  availableUnitNights: number | null;
  occupancyRate: number | null;
  availabilityCoverageComplete: boolean;
  coverageStartDate: string | null;
  unavailableReason: UnavailableReason | null;
}

interface FixtureState {
  calls: string[];
  releaseOccupancy?: () => void;
}

async function envelope(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    headers: { ...cors, "content-type": "application/json" },
    body: JSON.stringify({
      success: true,
      data,
      message: null,
      errors: [],
      code: null,
      metadata: null,
      pagination: null,
    }),
  });
}

function occupancyResponse(
  occupancyRate: number | null,
  unavailableReason: UnavailableReason | null = null
): OccupancyResponse {
  return {
    from: "2026-08-01",
    toExclusive: "2026-08-16",
    occupiedUnitNights: occupancyRate === 50 ? 5 : 1,
    availableUnitNights:
      unavailableReason === "coverage_incomplete"
        ? null
        : unavailableReason === "zero_capacity"
          ? 0
          : 10,
    occupancyRate,
    availabilityCoverageComplete: unavailableReason !== "coverage_incomplete",
    coverageStartDate:
      unavailableReason === "coverage_incomplete" ? null : "2026-08-01",
    unavailableReason,
  };
}

async function installFixture(
  page: Page,
  options: {
    response?: OccupancyResponse;
    failOccupancy?: boolean;
    deferOccupancy?: boolean;
    permissions?: string[];
  } = {}
): Promise<FixtureState> {
  const state: FixtureState = { calls: [] };
  const response = options.response ?? occupancyResponse(10);
  const permissions = options.permissions ?? ["analytics:read"];

  await page.route("http://occupancy-fixture.local/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.calls.push(`${request.method()} ${url.pathname}${url.search}`);

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }

    if (url.pathname === "/api/auth/refresh") {
      await envelope(route, {
        accessToken: "sanitized-access-token",
        expiresInSeconds: 3600,
        subjectType: "Admin",
        adminRole: "Operations",
        roleName: "Operations",
        user: {
          userId: "10000000-0000-4000-8000-000000000001",
          identifier: "operator@example.test",
          subjectType: "Admin",
          adminRole: "Operations",
          name: "LOCAL TEST Operator",
        },
        permissions,
      });
      return;
    }

    if (url.pathname.endsWith("/notifications/inbox/summary")) {
      await envelope(route, { totalCount: 0, unreadCount: 0, readCount: 0 });
      return;
    }

    if (url.pathname === "/api/internal/reports/occupancy") {
      if (options.deferOccupancy) {
        await new Promise<void>((resolve) => {
          state.releaseOccupancy = resolve;
        });
      }
      if (options.failOccupancy) {
        await route.fulfill({
          status: 500,
          headers: { ...cors, "content-type": "application/json" },
          body: JSON.stringify({
            success: false,
            data: null,
            message: "Fixture failure",
            errors: [],
            code: null,
            metadata: null,
          }),
        });
        return;
      }
      await envelope(route, response);
      return;
    }

    await envelope(route, null);
  });

  return state;
}

async function openDashboard(page: Page) {
  await page.clock.setFixedTime(new Date("2026-08-15T06:00:00.000Z"));
  await page.goto("/admin/dashboard");
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Operations dashboard" })
  ).toBeVisible({ timeout: 15_000 });
}

test("analytics-only dashboard renders the canonical rate and one half-open request", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const state = await installFixture(page, { response: occupancyResponse(10) });

  await openDashboard(page);

  const widget = page.getByRole("region", { name: "Occupancy rate" });
  await expect(widget.getByTestId("occupancy-value")).toHaveText("10%");
  await expect(
    widget.getByText("1 occupied unit-nights / 10 available unit-nights")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active units" })).toHaveCount(
    0
  );
  await expect
    .poll(() =>
      state.calls.filter((call) =>
        call.includes("/api/internal/reports/occupancy")
      )
    )
    .toEqual([
      "GET /api/internal/reports/occupancy?from=2026-08-01&toExclusive=2026-08-16",
    ]);
  expect(state.calls.some((call) => call.includes("/api/internal/units"))).toBe(
    false
  );
  expect(
    state.calls.some((call) => call.includes("/reports/bookings/summary"))
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  expect(consoleErrors).toEqual([]);
});

test("backend 50 percent is displayed without frontend derivation", async ({
  page,
}) => {
  await installFixture(page, { response: occupancyResponse(50) });
  await openDashboard(page);

  const widget = page.getByRole("region", { name: "Occupancy rate" });
  await expect(widget.getByTestId("occupancy-value")).toHaveText("50%");
  await expect(
    widget.getByText("5 occupied unit-nights / 10 available unit-nights")
  ).toBeVisible();
});

for (const scenario of [
  {
    reason: "coverage_incomplete" as const,
    message: "Capacity history is unavailable for this period.",
  },
  {
    reason: "zero_capacity" as const,
    message: "No rentable capacity is available for this period.",
  },
  {
    reason: "integrity_conflict" as const,
    message: "Occupancy data needs review before a rate can be shown.",
  },
]) {
  test(`${scenario.reason} renders N/A instead of a percentage`, async ({
    page,
  }) => {
    await installFixture(page, {
      response: occupancyResponse(null, scenario.reason),
    });
    await openDashboard(page);

    const widget = page.getByRole("region", { name: "Occupancy rate" });
    const value = widget.getByTestId("occupancy-value");
    await expect(value).toHaveText("N/A");
    await expect(value).not.toContainText("%");
    await expect(widget.getByText(scenario.message)).toBeVisible();
  });
}

test("request failure is distinct from a valid zero rate", async ({ page }) => {
  await installFixture(page, { failOccupancy: true });
  await openDashboard(page);

  const error = page.getByRole("alert", { name: "Occupancy rate" });
  await expect(error.getByText("Couldn't load occupancy")).toBeVisible({
    timeout: 15_000,
  });
  await expect(error).not.toContainText("0%");
});

test("loading state remains visible until the canonical request resolves", async ({
  page,
}) => {
  const state = await installFixture(page, { deferOccupancy: true });
  await openDashboard(page);

  await expect(page.getByTestId("occupancy-loading")).toBeVisible();
  await expect.poll(() => typeof state.releaseOccupancy).toBe("function");
  state.releaseOccupancy?.();
  await expect(page.getByTestId("occupancy-value")).toHaveText("10%");
});
