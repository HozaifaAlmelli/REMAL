import { expect, test, type Page, type Route } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import type {
  CrmAssigneeResponse,
  CrmLeadListItemResponse,
  CrmLeadStatus,
} from "../../lib/types/crm.types";

const API_ORIGIN = "http://crm-fixture.local";
const ADMIN_ID = "10000000-0000-4000-8000-000000000001";
const SECOND_ADMIN_ID = "10000000-0000-4000-8000-000000000002";
const CLIENT_ID = "40000000-0000-4000-8000-000000000001";
const AVAILABLE_UNIT_ID = "50000000-0000-4000-8000-000000000001";
const SECOND_UNIT_ID = "50000000-0000-4000-8000-000000000002";
const CREATED_CLIENT_ID = "40000000-0000-4000-8000-000000000002";
const CONVERTED_BOOKING_ID = "60000000-0000-4000-8000-000000000001";
const runtimeIssues = new WeakMap<Page, string[]>();

const assignees: CrmAssigneeResponse[] = [
  {
    id: ADMIN_ID,
    name: "Sanitized Sales One",
    email: "sales.one@example.test",
    roleName: "Sales",
  },
  {
    id: SECOND_ADMIN_ID,
    name: "Sanitized Sales Two",
    email: "sales.two@example.test",
    roleName: "Sales",
  },
];

const stageDistribution: Array<[CrmLeadStatus, number]> = [
  ["Prospecting", 40],
  ["Relevant", 20],
  ["NoAnswer", 12],
  ["Booked", 0],
  ["NotRelevant", 8],
];

const availableUnits = [
  {
    id: AVAILABLE_UNIT_ID,
    ownerId: "70000000-0000-4000-8000-000000000001",
    ownerName: "Sanitized Owner",
    projectId: "80000000-0000-4000-8000-000000000001",
    projectName: "Sanitized Project",
    name: "Sanitized Available Chalet",
    unitType: "chalet" as const,
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 3,
    basePricePerNight: 2500,
    isActive: true,
    isVisibleInPortfolio: true,
    createdAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: SECOND_UNIT_ID,
    ownerId: "70000000-0000-4000-8000-000000000001",
    ownerName: "Sanitized Owner",
    projectId: "80000000-0000-4000-8000-000000000002",
    projectName: "Sanitized Marina Project",
    name: "Sanitized Family Apartment",
    unitType: "apartment" as const,
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 5,
    basePricePerNight: 3100,
    isActive: true,
    isVisibleInPortfolio: true,
    createdAt: "2026-07-02T10:00:00.000Z",
  },
];

function createSanitizedLeads(): CrmLeadListItemResponse[] {
  let index = 0;

  return stageDistribution.flatMap(([leadStatus, count]) =>
    Array.from({ length: count }, () => {
      index += 1;
      const suffix = String(index).padStart(3, "0");
      const hasUnit = index % 5 !== 0;
      const needsRecommendation =
        !hasUnit &&
        index % 10 === 0 &&
        ["Prospecting", "Relevant", "NoAnswer", "Booked"].includes(leadStatus);
      const hasStayDetails = hasUnit || needsRecommendation;

      return {
        id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        clientId: null,
        targetUnitId: hasUnit
          ? `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`
          : null,
        assignedAdminUserId:
          index % 3 === 0 ? null : index % 2 === 0 ? ADMIN_ID : SECOND_ADMIN_ID,
        contactName:
          index === 1
            ? "Sanitized Lead With An Intentionally Long Contact Name"
            : `Sanitized Lead ${suffix}`,
        contactPhone: `+2010000${String(index).padStart(5, "0")}`,
        contactEmail: hasUnit ? `lead.${suffix}@example.test` : null,
        leadStatus,
        source: ["website", "whatsapp", "phone", "admin"][index % 4]!,
        desiredCheckInDate: hasStayDetails ? "2026-09-10" : null,
        desiredCheckOutDate: hasStayDetails ? "2026-09-14" : null,
        guestCount: hasStayDetails ? Math.min((index % 4) + 1, 3) : null,
        targetUnitName: hasUnit
          ? `Sanitized Unit ${String((index % 8) + 1).padStart(2, "0")}`
          : null,
        needsRecommendation,
        createdAt: new Date(
          Date.UTC(2026, 6, 20, 12, 0, 0) - index * 60_000
        ).toISOString(),
      };
    })
  );
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "http://localhost:3102",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "content-type": "application/json",
  };
}

async function fulfillEnvelope(
  route: Route,
  data: unknown,
  options?: {
    status?: number;
    message?: string;
    pagination?: {
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }
) {
  await route.fulfill({
    status: options?.status ?? 200,
    headers: corsHeaders(),
    body: JSON.stringify({
      success: (options?.status ?? 200) < 400,
      data,
      pagination: options?.pagination,
      message:
        options?.message ??
        ((options?.status ?? 200) < 400 ? null : "Fixture failure"),
      errors: [],
    }),
  });
}

interface FixtureApi {
  leads: CrmLeadListItemResponse[];
  leadListRequests: number;
  unitListRequests: number;
  lastUnitListQuery: URLSearchParams;
  unitListMode: "success" | "error" | "empty";
  statusUpdates: Array<{ leadId: string; status: CrmLeadStatus }>;
  writeRequests: Array<{ method: string; path: string }>;
  conversionPayloads: Array<{
    clientId: string;
    unitId: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
  }>;
  clientCreateRequests: number;
  failNextStatusUpdate: boolean;
  failNextConversionWithConflict: boolean;
}

async function installFixtureApi(page: Page): Promise<FixtureApi> {
  const state: FixtureApi = {
    leads: createSanitizedLeads(),
    leadListRequests: 0,
    unitListRequests: 0,
    lastUnitListQuery: new URLSearchParams(),
    unitListMode: "success",
    statusUpdates: [],
    writeRequests: [],
    conversionPayloads: [],
    clientCreateRequests: 0,
    failNextStatusUpdate: false,
    failNextConversionWithConflict: false,
  };

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }

    if (request.method() === "PUT" || request.method() === "PATCH") {
      state.writeRequests.push({
        method: request.method(),
        path: url.pathname,
      });
    }

    if (url.pathname === "/api/auth/refresh") {
      await fulfillEnvelope(route, {
        accessToken: "sanitized-local-access-token",
        expiresInSeconds: 3600,
        subjectType: "Admin",
        adminRole: "SuperAdmin",
        roleName: "Super Admin",
        user: {
          userId: ADMIN_ID,
          identifier: "qa.admin@example.test",
          subjectType: "Admin",
          adminRole: "SuperAdmin",
          name: "Sanitized QA Admin",
        },
        permissions: ["crm:read", "crm:write", "crm:assign"],
      });
      return;
    }

    if (url.pathname === "/api/internal/me/notifications/inbox/summary") {
      await fulfillEnvelope(route, {
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
      });
      return;
    }

    if (url.pathname === "/api/internal/crm/assignees") {
      await fulfillEnvelope(route, assignees);
      return;
    }

    if (url.pathname === "/api/internal/admin-directory") {
      await fulfillEnvelope(route, assignees);
      return;
    }

    if (url.pathname === "/api/internal/units" && request.method() === "GET") {
      state.unitListRequests += 1;
      state.lastUnitListQuery = new URLSearchParams(url.searchParams);
      if (state.unitListMode === "error") {
        await fulfillEnvelope(route, null, {
          status: 500,
          message: "Sanitized unit catalog failure",
        });
        return;
      }
      const unitType = url.searchParams.get("unitType");
      const units =
        state.unitListMode === "empty"
          ? []
          : unitType
            ? availableUnits.filter((unit) => unit.unitType === unitType)
            : availableUnits;
      await fulfillEnvelope(
        route,
        units,
        {
          pagination: {
            totalCount: units.length,
            page: 1,
            pageSize: 500,
            totalPages: 1,
          },
        }
      );
      return;
    }

    if (
      /^\/api\/units\/[^/]+\/availability\/operational-check$/.test(
        url.pathname
      ) &&
      request.method() === "POST"
    ) {
      const unitId = url.pathname.split("/")[3]!;
      await fulfillEnvelope(route, {
        unitId,
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        isAvailable: true,
        reason: null,
        blockedDates: [],
        heldDates: [],
      });
      return;
    }

    if (url.pathname === "/api/clients" && request.method() === "GET") {
      const search = (url.searchParams.get("search") ?? "")
        .replace(/\+/g, "")
        .toLowerCase();
      const client = {
        id: CLIENT_ID,
        name: "Sanitized Existing Client",
        phone: "+201000099999",
        email: "client@example.test",
        isActive: true,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-01T10:00:00.000Z",
      };
      const matches =
        search === client.phone.replace(/\+/g, "") ||
        search === client.email;
      const clients = matches ? [client] : [];
      await fulfillEnvelope(
        route,
        clients,
        {
          pagination: {
            totalCount: clients.length,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          },
        }
      );
      return;
    }

    if (url.pathname === "/api/clients" && request.method() === "POST") {
      state.clientCreateRequests += 1;
      const payload = request.postDataJSON() as {
        name: string;
        phone: string;
        email?: string;
      };
      await fulfillEnvelope(route, {
        id: CREATED_CLIENT_ID,
        name: payload.name,
        phone: payload.phone,
        email: payload.email ?? null,
        isActive: true,
        createdAt: "2026-07-27T10:00:00.000Z",
        updatedAt: "2026-07-27T10:00:00.000Z",
        temporaryPassword: "Sanitized-Temporary-Password",
      });
      return;
    }

    if (
      url.pathname === `/api/clients/${CLIENT_ID}` &&
      request.method() === "GET"
    ) {
      await fulfillEnvelope(route, {
        id: CLIENT_ID,
        name: "Sanitized Existing Client",
        phone: "+201000099999",
        email: "client@example.test",
        isActive: true,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-01T10:00:00.000Z",
      });
      return;
    }

    if (url.pathname === "/api/internal/crm/leads/open-count") {
      const openStatuses: CrmLeadStatus[] = [
        "Prospecting",
        "Relevant",
        "NoAnswer",
        "Booked",
      ];
      await fulfillEnvelope(
        route,
        state.leads.filter((lead) => openStatuses.includes(lead.leadStatus))
          .length
      );
      return;
    }

    if (
      url.pathname === "/api/internal/crm/leads" &&
      request.method() === "GET"
    ) {
      state.leadListRequests += 1;
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      const requestedPageSize = Number(
        url.searchParams.get("pageSize") ?? "20"
      );
      const pageSize = Math.min(requestedPageSize, 30);
      const start = (pageNumber - 1) * pageSize;
      const items = state.leads.slice(start, start + pageSize);

      await fulfillEnvelope(route, items, {
        pagination: {
          totalCount: state.leads.length,
          page: pageNumber,
          pageSize,
          totalPages: Math.max(1, Math.ceil(state.leads.length / pageSize)),
        },
      });
      return;
    }

    const statusMatch = url.pathname.match(
      /^\/api\/internal\/crm\/leads\/([^/]+)\/status$/
    );
    if (statusMatch && request.method() === "PATCH") {
      const leadId = statusMatch[1]!;
      const payload = request.postDataJSON() as { leadStatus: CrmLeadStatus };

      if (state.failNextStatusUpdate) {
        state.failNextStatusUpdate = false;
        await fulfillEnvelope(route, null, { status: 500 });
        return;
      }

      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) {
        await fulfillEnvelope(route, null, { status: 404 });
        return;
      }

      lead.leadStatus = payload.leadStatus;
      state.statusUpdates.push({ leadId, status: payload.leadStatus });
      await fulfillEnvelope(route, {
        ...lead,
        notes: null,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (
      url.pathname ===
        `/api/internal/bookings/${CONVERTED_BOOKING_ID}/finance-snapshot` &&
      request.method() === "GET"
    ) {
      await fulfillEnvelope(route, null);
      return;
    }

    if (
      url.pathname ===
        `/api/internal/bookings/${CONVERTED_BOOKING_ID}/status-history` &&
      request.method() === "GET"
    ) {
      await fulfillEnvelope(route, []);
      return;
    }

    if (
      url.pathname === `/api/internal/bookings/${CONVERTED_BOOKING_ID}` &&
      request.method() === "GET"
    ) {
      await fulfillEnvelope(route, {
        id: CONVERTED_BOOKING_ID,
        clientId: CLIENT_ID,
        unitId: AVAILABLE_UNIT_ID,
        unitName: "Sanitized Available Chalet",
        ownerId: "70000000-0000-4000-8000-000000000001",
        assignedAdminUserId: null,
        assignedAdminUserName: null,
        assignedAdminUserRole: null,
        bookingStatus: "Booked",
        checkInDate: "2026-09-10",
        checkOutDate: "2026-09-14",
        guestCount: 3,
        baseAmount: 10000,
        finalAmount: 10000,
        source: "website",
        internalNotes: null,
        createdAt: "2026-07-27T10:00:00.000Z",
        updatedAt: "2026-07-27T10:00:00.000Z",
        isAgedSoftHold: false,
        softHoldAgeDays: null,
      });
      return;
    }

    const unitDetailMatch = url.pathname.match(
      /^\/api\/internal\/units\/([^/]+)$/
    );
    if (unitDetailMatch && request.method() === "GET") {
      const fixtureUnit =
        availableUnits.find((unit) => unit.id === unitDetailMatch[1]) ??
        {
          ...availableUnits[0],
          id: unitDetailMatch[1]!,
          name:
            state.leads.find(
              (lead) => lead.targetUnitId === unitDetailMatch[1]
            )?.targetUnitName ?? "Sanitized Linked Unit",
        };
      await fulfillEnvelope(route, {
        ...fixtureUnit,
        description: null,
        address: null,
        updatedAt: "2026-07-01T10:00:00.000Z",
      });
      return;
    }

    if (
      url.pathname === "/api/internal/payments" &&
      request.method() === "GET"
    ) {
      await fulfillEnvelope(route, [], {
        pagination: {
          totalCount: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      });
      return;
    }

    const convertMatch = url.pathname.match(
      /^\/api\/internal\/crm\/leads\/([^/]+)\/convert-to-booking$/
    );
    if (convertMatch && request.method() === "POST") {
      const payload =
        request.postDataJSON() as FixtureApi["conversionPayloads"][number];
      state.conversionPayloads.push(payload);

      if (state.failNextConversionWithConflict) {
        state.failNextConversionWithConflict = false;
        await fulfillEnvelope(route, null, {
          status: 409,
          message: `Unit ${payload.unitId} is not available for the requested dates.`,
        });
        return;
      }

      const lead = state.leads.find((item) => item.id === convertMatch[1]);
      if (lead) {
        lead.leadStatus = "Completed";
        lead.targetUnitId = payload.unitId;
        lead.targetUnitName = "Sanitized Available Chalet";
        lead.needsRecommendation = false;
      }
      await fulfillEnvelope(route, {
        id: CONVERTED_BOOKING_ID,
        clientId: payload.clientId,
        unitId: payload.unitId,
        unitName: "Sanitized Available Chalet",
        ownerId: "70000000-0000-4000-8000-000000000001",
        assignedAdminUserId: null,
        assignedAdminUserName: null,
        assignedAdminUserRole: null,
        bookingStatus: "Booked",
        checkInDate: payload.checkInDate,
        checkOutDate: payload.checkOutDate,
        guestCount: payload.guestCount,
        baseAmount: 10000,
        finalAmount: 10000,
        source: "website",
        internalNotes: null,
        createdAt: "2026-07-27T10:00:00.000Z",
        updatedAt: "2026-07-27T10:00:00.000Z",
        isAgedSoftHold: false,
        softHoldAgeDays: null,
      });
      return;
    }

    const detailMatch = url.pathname.match(
      /^\/api\/internal\/crm\/leads\/([^/]+)$/
    );
    if (detailMatch && request.method() === "GET") {
      const lead = state.leads.find((item) => item.id === detailMatch[1]);
      await fulfillEnvelope(
        route,
        lead ? { ...lead, notes: null, updatedAt: lead.createdAt } : null,
        { status: lead ? 200 : 404 }
      );
      return;
    }

    if (/\/notes$/.test(url.pathname)) {
      await fulfillEnvelope(route, []);
      return;
    }

    if (/\/assignment$/.test(url.pathname)) {
      await fulfillEnvelope(route, null);
      return;
    }

    await fulfillEnvelope(route, null, { status: 404 });
  });

  return state;
}

async function openCrm(page: Page, path = "/admin/crm") {
  await page.goto(path);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Leads pipeline", level: 1 })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("crm-lead-count")).toHaveText("30 of 80 leads");

  const loadMore = page.getByRole("button", { name: "Load more leads" });
  await loadMore.click();
  await expect(page.getByTestId("crm-lead-count")).toHaveText("60 of 80 leads");
  await loadMore.click();
  await expect(page.getByTestId("crm-lead-count")).toHaveText("80 leads");
  await expect(loadMore).toBeHidden();
}

async function captureReviewScreenshot(page: Page, name: string) {
  if (process.env.CRM_CAPTURE_SCREENSHOTS !== "1") return;

  const outputDirectory = path.resolve(
    process.cwd(),
    "..",
    "docs",
    "qa",
    "crm-prospecting-scroll-and-views"
  );
  fs.mkdirSync(outputDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(outputDirectory, `${name}.png`),
    fullPage: false,
  });
}

test.beforeEach(async ({ page }) => {
  const issues: string[] = [];
  runtimeIssues.set(page, issues);
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) =>
    issues.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
    )
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push(`console: ${message.text()}`);
    }
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.context().addCookies([
    {
      name: "refresh_token",
      value: "sanitized-local-refresh-token",
      url: "http://localhost:3102",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test.afterEach(async ({ page }, testInfo) => {
  const issues = runtimeIssues.get(page) ?? [];
  const allowsExpected500 =
    testInfo.title ===
      "dragging into an empty stage updates only the intended lead and failure keeps state" ||
    testInfo.title ===
      "unit step recovers from catalog errors and distinguishes an empty result";
  const allowsExpected409 =
    testInfo.title ===
    "recommendation conversion clears a stale pick after an availability conflict";
  const unexpectedIssues = issues.filter((issue) => {
    if (
      issue.startsWith("requestfailed:") &&
      issue.includes("_rsc=") &&
      issue.includes("net::ERR_ABORTED")
    ) {
      return false;
    }
    if (
      allowsExpected500 &&
      issue.includes(
        "Failed to load resource: the server responded with a status of 500"
      )
    ) {
      return false;
    }
    if (
      allowsExpected409 &&
      issue.includes(
        "Failed to load resource: the server responded with a status of 409"
      )
    ) {
      return false;
    }
    return true;
  });

  expect(unexpectedIssues).toEqual([]);
});

test("renders all loaded cards and independently scrolls a long stage", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  await openCrm(page);
  expect(fixture.leadListRequests).toBe(3);

  const prospectingColumn = page.locator('[data-stage="Prospecting"]');
  const prospectingList = page.getByTestId("crm-stage-list-Prospecting");
  const prospectingCards = prospectingColumn.locator('[role="listitem"]');
  const board = page.getByTestId("crm-pipeline-board");

  await expect(prospectingCards).toHaveCount(40);
  await expect(
    prospectingColumn.getByText("40", { exact: true })
  ).toBeVisible();
  await captureReviewScreenshot(page, "pipeline-long-stage");

  const initialMetrics = await prospectingList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  expect(initialMetrics.scrollHeight).toBeGreaterThan(
    initialMetrics.clientHeight
  );
  expect(initialMetrics.scrollTop).toBe(0);

  await prospectingList.hover();
  await page.mouse.wheel(0, 480);
  await expect
    .poll(() => prospectingList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  const headerBefore = await prospectingColumn
    .getByRole("heading", { name: "Prospecting" })
    .boundingBox();
  await prospectingList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await expect(prospectingCards.last()).toBeVisible();
  const finalCardBox = await prospectingCards.last().boundingBox();
  const listBox = await prospectingList.boundingBox();
  expect(finalCardBox).not.toBeNull();
  expect(listBox).not.toBeNull();
  expect(finalCardBox!.y + finalCardBox!.height).toBeLessThanOrEqual(
    listBox!.y + listBox!.height + 1
  );

  const headerAfter = await prospectingColumn
    .getByRole("heading", { name: "Prospecting" })
    .boundingBox();
  expect(headerAfter?.y).toBe(headerBefore?.y);
  await captureReviewScreenshot(page, "pipeline-final-lead");

  const boardMetrics = await board.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(boardMetrics.scrollWidth).toBeGreaterThan(boardMetrics.clientWidth);
  await board.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(page.locator('[data-stage="Booked"]')).toBeVisible();

  await prospectingList.evaluate((element) => {
    element.scrollTop = 420;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByTestId("crm-stage-list-Prospecting")
        .evaluate((element) => element.scrollTop)
    )
    .toBeGreaterThan(300);

  await page.getByRole("button", { name: /Show closed leads/ }).click();
  await expect(page.locator('[role="listitem"]')).toHaveCount(80);
});

test("switches views, preserves filters, paginates, and restores URL state", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  await openCrm(page);
  const requestCountBeforeViewSwitch = fixture.leadListRequests;

  await page.getByLabel("Search leads").fill("Sanitized Lead");
  await page.getByLabel("Filter by stage").selectOption("Prospecting");
  await expect(page).toHaveURL(/q=Sanitized\+Lead/);
  await expect(page).toHaveURL(/stage=Prospecting/);
  await expect(page.getByTestId("crm-lead-count")).toHaveText("40 of 80 leads");

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page).toHaveURL(/stage=Prospecting/);
  await expect(page.getByText("Showing 1–25 of 40 results")).toBeVisible();
  expect(fixture.leadListRequests).toBe(requestCountBeforeViewSwitch);
  await captureReviewScreenshot(page, "list-filter-preserved");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Showing 26–40 of 40 results")).toBeVisible();

  await page.waitForTimeout(250);
  await page.goBack();
  await expect(page.getByText("Showing 1–25 of 40 results")).toBeVisible();
  await page.waitForTimeout(250);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Pipeline", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Search leads")).toHaveValue("Sanitized Lead");
  await expect(page.getByLabel("Filter by stage")).toHaveValue("Prospecting");
  await page.waitForTimeout(500);

  await page.goto("/admin/crm?view=unsupported");
  await expect(
    page.getByRole("button", { name: "Pipeline", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
});

test("list view exposes every lead through pagination and opens row details", async ({
  page,
}) => {
  await installFixtureApi(page);
  await openCrm(page, "/admin/crm?view=list");

  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(25);
  await expect(page.getByText("Showing 1–25 of 80 results")).toBeVisible();
  await captureReviewScreenshot(page, "list-view");

  await page.getByLabel("Filter by source").selectOption("phone");
  await expect(page).toHaveURL(/source=phone/);
  await expect(page.getByTestId("crm-lead-count")).toHaveText("20 of 80 leads");
  await page.getByLabel("Filter by assigned owner").selectOption("unassigned");
  await expect(page).toHaveURL(/owner=unassigned/);
  await expect(page.getByTestId("crm-lead-count")).toHaveText(
    /\d+ of 80 leads/
  );
  await page.getByRole("button", { name: "Clear CRM filters" }).click();
  await expect(page.getByTestId("crm-lead-count")).toHaveText("80 leads");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 26–50 of 80 results")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 51–75 of 80 results")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 76–80 of 80 results")).toBeVisible();
  await expect(rows).toHaveCount(5);

  const finalLead = rows.last();
  await finalLead.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/crm\/leads\/20000000-/);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Sanitized Lead 080", level: 1 })
  ).toBeVisible();
});

test("pipeline, list, and details distinguish recommendation requests from legacy unitless leads", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  await openCrm(page);

  const classifiedLead = fixture.leads.find(
    (lead) => lead.needsRecommendation && lead.leadStatus === "Prospecting"
  )!;
  const unclassifiedLead = fixture.leads.find(
    (lead) =>
      !lead.needsRecommendation &&
      !lead.targetUnitId &&
      lead.leadStatus === "Prospecting"
  )!;

  const classifiedCard = page.getByRole("button", {
    name: `Open ${classifiedLead.contactName}`,
  });
  await expect(
    classifiedCard.getByText("Needs Recommendation", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByLabel("Search leads").fill(classifiedLead.contactName);
  const classifiedRow = page.locator("tbody tr").filter({
    hasText: classifiedLead.contactName,
  });
  await expect(
    classifiedRow.getByText("Needs Recommendation", { exact: true })
  ).toBeVisible();

  const forbiddenCopy = [
    ["Recommendation", "Sent"].join(" "),
    ["Recommendation", "Unavailable"].join(" "),
    ["Unit", "On", "Hold"].join(" "),
    ["Not", "Reserved"].join(" "),
    ["Hold", "Expired"].join(" "),
    ["Needs", "New", "Recommendation"].join(" "),
  ];
  for (const text of forbiddenCopy) {
    await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  }

  await page.goto(`/admin/crm/leads/${classifiedLead.id}`);
  await expect(
    page.getByRole("heading", {
      name: classifiedLead.contactName,
      level: 1,
    })
  ).toBeVisible();
  await expect(
    page.getByText("Waiting for unit recommendation", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(
      "This request came in without a unit. Pick an available unit when you convert it to a booking.",
      { exact: true }
    )
  ).toBeVisible();
  const unitInquiry = page
    .getByRole("heading", { name: "Unit inquiry", level: 2 })
    .locator("..");
  await expect(unitInquiry.getByRole("alert")).toHaveCount(0);

  await page.goto(`/admin/crm/leads/${unclassifiedLead.id}`);
  await expect(
    page.getByText("Unit not selected", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Needs Recommendation", { exact: true })
  ).toHaveCount(0);

  const recommendationWithoutDates = fixture.leads.find(
    (lead) =>
      lead.needsRecommendation &&
      lead.id !== classifiedLead.id &&
      lead.leadStatus === "Prospecting"
  )!;
  recommendationWithoutDates.leadStatus = "Booked";
  recommendationWithoutDates.desiredCheckInDate = null;
  recommendationWithoutDates.desiredCheckOutDate = null;
  await page.goto(`/admin/crm/leads/${recommendationWithoutDates.id}`);
  await expect(
    page.getByRole("heading", {
      name: "Stay details",
      level: 3,
    })
  ).toBeVisible();
  await expect(page.getByLabel("Check-in")).toBeVisible();
  await expect(page.getByLabel("Check-out")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sanitized Available Chalet/ })
  ).toHaveCount(0);
});

test("wizard derives the visible steps from unit, client, stay, and converted state", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  const recommendations = fixture.leads.filter(
    (item) => item.needsRecommendation && item.desiredCheckInDate
  );
  const noUnitNoClient = recommendations[0]!;
  noUnitNoClient.leadStatus = "Booked";

  await page.goto(`/admin/crm/leads/${noUnitNoClient.id}`);
  const wizard = page.getByRole("region", {
    name: "Create booking from lead",
  });
  const stepper = wizard.getByRole("navigation", {
    name: "Create booking from lead",
  });
  await expect(stepper.locator("li")).toHaveCount(4);
  await expect(
    page.getByRole("heading", {
      name: "Choose an available unit",
      level: 3,
    })
  ).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveCount(0);
  await expect(page.getByLabel("Guests")).toHaveCount(0);

  const noUnitWithClient = recommendations[1]!;
  noUnitWithClient.leadStatus = "Booked";
  noUnitWithClient.clientId = CLIENT_ID;
  await page.goto(`/admin/crm/leads/${noUnitWithClient.id}`);
  await expect(
    page
      .getByRole("navigation", { name: "Create booking from lead" })
      .locator("li")
  ).toHaveCount(3);
  await expect(
    page.getByRole("heading", {
      name: "Choose an available unit",
      level: 3,
    })
  ).toBeVisible();

  const withUnitNoClient = fixture.leads.find(
    (item) => item.targetUnitId && !item.clientId
  )!;
  withUnitNoClient.leadStatus = "Booked";
  await page.goto(`/admin/crm/leads/${withUnitNoClient.id}`);
  await expect(
    page
      .getByRole("navigation", { name: "Create booking from lead" })
      .locator("li")
  ).toHaveCount(3);
  await expect(
    page.getByRole("heading", {
      name: "Create or attach a client",
      level: 3,
    })
  ).toBeVisible();

  const withUnitAndClient = fixture.leads.find(
    (item) =>
      item.targetUnitId &&
      item.id !== withUnitNoClient.id &&
      !item.needsRecommendation
  )!;
  withUnitAndClient.leadStatus = "Booked";
  withUnitAndClient.clientId = CLIENT_ID;
  await page.goto(`/admin/crm/leads/${withUnitAndClient.id}`);
  await expect(
    page
      .getByRole("navigation", { name: "Create booking from lead" })
      .locator("li")
  ).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Booking details", level: 3 })
  ).toBeVisible();

  const missingStay = recommendations[2]!;
  missingStay.leadStatus = "Booked";
  missingStay.desiredCheckInDate = null;
  missingStay.desiredCheckOutDate = null;
  await page.goto(`/admin/crm/leads/${missingStay.id}`);
  await expect(
    page
      .getByRole("navigation", { name: "Create booking from lead" })
      .locator("li")
  ).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "Stay details", level: 3 })
  ).toBeVisible();

  const converted = recommendations[3]!;
  converted.leadStatus = "Completed";
  await page.goto(`/admin/crm/leads/${converted.id}`);
  await expect(
    page.getByRole("region", { name: "Create booking from lead" })
  ).toHaveCount(0);
});

test("wizard keeps one task visible and preserves unit and client state through navigation", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  const lead = fixture.leads.find(
    (item) => item.needsRecommendation && item.desiredCheckInDate
  )!;
  lead.leadStatus = "Booked";
  lead.contactName = "Sanitized Existing Client";
  lead.contactPhone = "+201000099999";
  lead.contactEmail = "client@example.test";

  await page.goto(`/admin/crm/leads/${lead.id}`);
  const continueButton = page.getByRole("button", {
    name: "Continue",
    exact: true,
  });
  await expect(continueButton).toBeDisabled();
  await expect(page.getByLabel("Full name")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Choose unit\. Current step/ })
  ).toHaveAttribute("aria-current", "step");
  await expect(
    page.getByRole("button", { name: /Client\. Complete the previous step/ })
  ).toBeDisabled();

  const search = page.getByLabel("Search units by name or project");
  const unitRequestsBeforeSearch = fixture.unitListRequests;
  await expect
    .poll(() => fixture.lastUnitListQuery.get("isActive"))
    .toBe("true");
  await search.fill("Family");
  await expect(
    page.getByRole("button", { name: /Sanitized Family Apartment/ })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sanitized Available Chalet/ })
  ).toHaveCount(0);
  await search.clear();
  expect(fixture.unitListRequests).toBe(unitRequestsBeforeSearch);

  await page.getByRole("button", { name: "Chalet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Sanitized Available Chalet/ })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sanitized Family Apartment/ })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();

  const unitOption = page.getByRole("button", {
    name: /Sanitized Available Chalet/,
  });
  const writesBeforePick = fixture.writeRequests.length;
  await unitOption.focus();
  await page.keyboard.press("Space");
  await expect(unitOption).toHaveAttribute("aria-pressed", "true");
  expect(fixture.writeRequests).toHaveLength(writesBeforePick);
  await continueButton.click();

  await expect(
    page.getByRole("heading", {
      name: "Create or attach a client",
      level: 3,
    })
  ).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue(
    "Sanitized Existing Client"
  );
  await expect(page.getByLabel("Phone number")).toHaveValue("+201000099999");
  await page
    .getByRole("button", { name: "Create or attach client", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Booking details", level: 3 })
  ).toBeVisible();
  expect(fixture.clientCreateRequests).toBe(0);
  await expect(page.getByLabel("Guests")).toHaveValue(
    String(lead.guestCount)
  );

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Linked client", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(unitOption).toHaveAttribute("aria-pressed", "true");
  expect(fixture.writeRequests).toHaveLength(writesBeforePick);
});

test("unit step recovers from catalog errors and distinguishes an empty result", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  const lead = fixture.leads.find(
    (item) => item.needsRecommendation && item.desiredCheckInDate
  )!;
  lead.leadStatus = "Booked";
  lead.clientId = CLIENT_ID;
  fixture.unitListMode = "error";

  await page.goto(`/admin/crm/leads/${lead.id}`);
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "Available units could not be loaded. Check your connection and try again.",
    })
  ).toBeVisible();

  fixture.unitListMode = "empty";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByText(
      "No available units were found for the selected stay.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true })
  ).toBeDisabled();

  fixture.unitListMode = "success";
  await page.getByRole("button", { name: "Chalet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Sanitized Available Chalet/ })
  ).toBeVisible();
});

test("missing stay and new client data progress without losing wizard state", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  const lead = fixture.leads.find((item) => item.needsRecommendation)!;
  lead.leadStatus = "Booked";
  lead.desiredCheckInDate = null;
  lead.desiredCheckOutDate = null;
  lead.guestCount = null;

  await page.goto(`/admin/crm/leads/${lead.id}`);
  await page.getByLabel("Check-in").fill("2026-10-10");
  await page.getByLabel("Check-out").fill("2026-10-13");
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();

  await page
    .getByRole("button", { name: /Sanitized Family Apartment/ })
    .click();
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toHaveValue(lead.contactName);
  await expect(page.getByLabel("Phone number")).toHaveValue(lead.contactPhone);
  await page.getByLabel("Email (optional)").focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Booking details", level: 3 })
  ).toBeVisible();
  expect(fixture.clientCreateRequests).toBe(1);
  await expect(
    page.getByText("Temporary password", { exact: true })
  ).toBeVisible();
  await page.getByLabel("Guests").fill("2");
  await page.getByLabel("Internal notes (optional)").fill(
    "Sanitized new-client booking note"
  );
  await page
    .getByRole("button", { name: "Back", exact: true })
    .click();
  await expect(page.getByText("Linked client", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Sanitized Family Apartment/ })
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Check-in")).toHaveValue("2026-10-10");
  await expect(page.getByLabel("Check-out")).toHaveValue("2026-10-13");
});

test("booked recommendation reviews and creates exactly one booking", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  const lead = fixture.leads.find(
    (item) => item.needsRecommendation && item.desiredCheckInDate
  )!;
  lead.leadStatus = "Booked";
  lead.clientId = CLIENT_ID;

  await page.goto(`/admin/crm/leads/${lead.id}`);

  const unitOption = page.getByRole("button", {
    name: /Sanitized Available Chalet/,
  });
  const writesBeforePick = fixture.writeRequests.length;
  await unitOption.click();
  await expect(unitOption).toHaveAttribute("aria-pressed", "true");
  expect(fixture.writeRequests).toHaveLength(writesBeforePick);
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Booking details", level: 3 })
  ).toBeVisible();
  await page.getByLabel("Internal notes (optional)").fill(
    "Sanitized operational context"
  );
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review and create", level: 3 })
  ).toBeVisible();
  await expect(
    page.getByText(
      "The unit is not reserved until the booking is successfully created. Availability will be checked again when you confirm.",
      { exact: true }
    )
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Booking details", level: 4 })
    .locator("..")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(page.getByLabel("Internal notes (optional)")).toHaveValue(
    "Sanitized operational context"
  );
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();

  const convertResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/api/internal/crm/leads/${lead.id}/convert-to-booking`) &&
      response.request().method() === "POST"
  );
  await page
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  await convertResponse;

  expect(fixture.conversionPayloads).toHaveLength(1);
  expect(fixture.conversionPayloads[0]).toMatchObject({
    clientId: CLIENT_ID,
    unitId: AVAILABLE_UNIT_ID,
    checkInDate: lead.desiredCheckInDate,
    checkOutDate: lead.desiredCheckOutDate,
    guestCount: lead.guestCount,
  });
  expect(fixture.writeRequests).toHaveLength(writesBeforePick);
  await expect(page).toHaveURL(
    new RegExp(`/admin/bookings/${CONVERTED_BOOKING_ID}$`)
  );
  await expect(
    page.getByRole("heading", { name: "Booking summary", level: 2 })
  ).toBeVisible();
});

test("recommendation conversion clears a stale pick after an availability conflict", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  const lead = fixture.leads.find(
    (item) => item.needsRecommendation && item.desiredCheckInDate
  )!;
  lead.leadStatus = "Booked";
  lead.clientId = CLIENT_ID;
  fixture.failNextConversionWithConflict = true;

  await page.goto(`/admin/crm/leads/${lead.id}`);
  const unitOption = page.getByRole("button", {
    name: /Sanitized Available Chalet/,
  });
  const writesBeforePick = fixture.writeRequests.length;
  await unitOption.click();
  expect(fixture.writeRequests).toHaveLength(writesBeforePick);
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();

  const guests = page.getByLabel("Guests");
  await guests.fill("4");
  await expect(page.getByText(/accepts up to 3 guests/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true })
  ).toBeDisabled();
  await guests.fill("3");
  await page.getByLabel("Internal notes (optional)").fill(
    "Preserve this note after conflict"
  );
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();

  await page
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "The selected unit is no longer available for these dates. Choose another available unit to continue.",
    })
  ).toHaveText(
    "The selected unit is no longer available for these dates. Choose another available unit to continue."
  );
  await expect(unitOption).toHaveAttribute("aria-pressed", "false");
  expect(fixture.writeRequests).toHaveLength(writesBeforePick);

  const secondUnit = page.getByRole("button", {
    name: /Sanitized Family Apartment/,
  });
  await secondUnit.click();
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(page.getByLabel("Internal notes (optional)")).toHaveValue(
    "Preserve this note after conflict"
  );
  await expect(page.getByLabel("Guests")).toHaveValue("3");
  expect(fixture.conversionPayloads).toHaveLength(1);
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/bookings/${CONVERTED_BOOKING_ID}$`)
  );
  expect(fixture.conversionPayloads).toHaveLength(2);
});

test("wizard adapts to mobile and Arabic RTL without horizontal overflow", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  const lead = fixture.leads.find(
    (item) => item.needsRecommendation && item.desiredCheckInDate
  )!;
  lead.leadStatus = "Booked";
  lead.clientId = CLIENT_ID;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/crm/leads/${lead.id}`);
  await page.evaluate(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  });

  const wizard = page.getByRole("region", {
    name: "إنشاء حجز من الـ Lead",
  });
  await expect(wizard).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("الخطوة 1 من 3", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "اختر وحدة متاحة", level: 3 })
  ).toBeVisible();
  await expect(
    page.getByLabel("ابحث باسم الوحدة أو المشروع")
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("wizard remains readable and reachable across supported viewports", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  const lead = fixture.leads.find(
    (item) => item.needsRecommendation && item.desiredCheckInDate
  )!;
  lead.leadStatus = "Booked";
  lead.clientId = CLIENT_ID;

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/admin/crm/leads/${lead.id}`);

    const wizard = page.getByRole("region", {
      name: "Create booking from lead",
    });
    await expect(wizard).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sanitized Available Chalet/ })
    ).toBeVisible();

    const layout = await page.evaluate(() => ({
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth,
      wizardOverflow: (() => {
        const element = document.querySelector(
          '[aria-labelledby="crm-booking-wizard-title"]'
        );
        return element
          ? element.scrollWidth > element.clientWidth + 1
          : true;
      })(),
    }));
    expect(layout.documentOverflow).toBe(false);
    expect(layout.wizardOverflow).toBe(false);

    if (viewport.width < 640) {
      await expect(
        page.getByText("Step 1 of 3", { exact: true })
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("button", { name: /Choose unit\. Current step/ })
      ).toBeVisible();
    }
  }
});

test("dragging into an empty stage updates only the intended lead and failure keeps state", async ({
  page,
}) => {
  const fixture = await installFixtureApi(page);
  await openCrm(page);

  const relevantColumn = page.locator('[data-stage="Relevant"]');
  const relevantList = page.getByTestId("crm-stage-list-Relevant");
  const bookedColumn = page.locator('[data-stage="Booked"]');
  const bookedList = page.getByTestId("crm-stage-list-Booked");
  const sourceCard = relevantColumn
    .locator('[role="listitem"] [role="button"]')
    .first();

  await bookedColumn.scrollIntoViewIfNeeded();
  await sourceCard.scrollIntoViewIfNeeded();

  await relevantList.evaluate((element) => {
    element.scrollTop = 0;
    const column = element.closest('[data-stage="Relevant"]');
    const bounds = element.getBoundingClientRect();
    column?.dispatchEvent(
      new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        clientY: bounds.bottom - 2,
        dataTransfer: new DataTransfer(),
      })
    );
  });
  await expect
    .poll(() => relevantList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await sourceCard.dragTo(bookedList);
  await expect(bookedColumn.locator('[role="listitem"]')).toHaveCount(1);
  await expect(relevantColumn.locator('[role="listitem"]')).toHaveCount(19);
  expect(fixture.statusUpdates).toHaveLength(1);
  expect(new Set(fixture.leads.map((lead) => lead.id)).size).toBe(80);

  fixture.failNextStatusUpdate = true;
  const secondSourceCard = relevantColumn
    .locator('[role="listitem"] [role="button"]')
    .first();
  await secondSourceCard.dragTo(bookedList);
  await expect(page.getByText("Cannot move lead to this stage")).toBeVisible();
  await expect(bookedColumn.locator('[role="listitem"]')).toHaveCount(1);
  await expect(relevantColumn.locator('[role="listitem"]')).toHaveCount(19);
  expect(fixture.statusUpdates).toHaveLength(1);
  expect(new Set(fixture.leads.map((lead) => lead.id)).size).toBe(80);
});

test("remains usable at tablet and mobile widths", async ({ page }) => {
  await installFixtureApi(page);
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openCrm(page);

    await expect(
      page.getByRole("button", { name: "Pipeline", exact: true })
    ).toBeVisible();
    const prospectingList = page.getByTestId("crm-stage-list-Prospecting");
    expect(
      await prospectingList.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true);

    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(25);
    const tableScroller = page.locator("table").locator("..");
    expect(
      await tableScroller.evaluate(
        (element) => element.scrollWidth > element.clientWidth
      )
    ).toBe(true);
    await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  }
});

test("keeps long stages reachable at supported desktop viewports", async ({
  page,
}) => {
  await installFixtureApi(page);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await openCrm(page);
    const list = page.getByTestId("crm-stage-list-Prospecting");
    const cards = page
      .locator('[data-stage="Prospecting"]')
      .locator('[role="listitem"]');

    await expect(cards).toHaveCount(40);
    expect(
      await list.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true);
    await list.focus();
    await page.keyboard.press("End");
    await expect(cards.last()).toBeVisible();
  }
});
