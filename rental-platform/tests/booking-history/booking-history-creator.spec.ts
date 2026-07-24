import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import type {
  BookingDetailsResponse,
  BookingStatusHistoryResponse,
  CreateBookingRequest,
} from "../../lib/types/booking.types";

const API_ORIGIN = "http://booking-history-fixture.local";
const ADMIN_A_ID = "10000000-0000-4000-8000-000000000001";
const ADMIN_B_ID = "10000000-0000-4000-8000-000000000002";
const BOOKING_ID = "20000000-0000-4000-8000-000000000001";
const CLIENT_ID = "30000000-0000-4000-8000-000000000001";
const UNIT_ID = "40000000-0000-4000-8000-000000000001";
const OWNER_ID = "50000000-0000-4000-8000-000000000001";
const PROJECT_ID = "60000000-0000-4000-8000-000000000001";
const runtimeIssues = new WeakMap<Page, string[]>();

const admins = {
  [ADMIN_A_ID]: {
    id: ADMIN_A_ID,
    name: "Sanitized Admin A With A Deliberately Long Display Name",
    email: "admin-a@example.test",
  },
  [ADMIN_B_ID]: {
    id: ADMIN_B_ID,
    name: "Sanitized Admin B",
    email: "admin-b@example.test",
  },
};

interface FixtureState {
  currentAdminId: keyof typeof admins;
  booking: BookingDetailsResponse | null;
  history: BookingStatusHistoryResponse[];
  creationPayloads: CreateBookingRequest[];
  historyRequests: number;
}

function createState(): FixtureState {
  return {
    currentAdminId: ADMIN_A_ID,
    booking: null,
    history: [],
    creationPayloads: [],
    historyRequests: 0,
  };
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "http://localhost:3103",
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
    pagination?: {
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }
) {
  const status = options?.status ?? 200;
  await route.fulfill({
    status,
    headers: corsHeaders(),
    body: JSON.stringify({
      success: status < 400,
      data,
      pagination: options?.pagination,
      message: status < 400 ? null : "Sanitized fixture failure",
      errors: [],
    }),
  });
}

function bookingFromRequest(
  request: CreateBookingRequest
): BookingDetailsResponse {
  const now = "2026-07-24T08:00:00.000Z";
  return {
    id: BOOKING_ID,
    clientId: request.clientId,
    unitId: request.unitId,
    unitName: "Sanitized Unit",
    ownerId: OWNER_ID,
    assignedAdminUserId: request.assignedAdminUserId ?? null,
    assignedAdminUserName: null,
    assignedAdminUserRole: null,
    bookingStatus: "Prospecting",
    checkInDate: request.checkInDate,
    checkOutDate: request.checkOutDate,
    guestCount: request.guestCount,
    baseAmount: 2_000,
    finalAmount: 2_000,
    source: request.source,
    internalNotes: request.internalNotes ?? null,
    createdAt: now,
    updatedAt: now,
    isAgedSoftHold: false,
    softHoldAgeDays: 0,
  };
}

function historyEntry(options: {
  id: string;
  oldStatus: BookingStatusHistoryResponse["oldStatus"];
  newStatus: BookingStatusHistoryResponse["newStatus"];
  actorUserId: string | null;
  actorDisplayName: string;
  actorType: BookingStatusHistoryResponse["actorType"];
  notes: string;
  changedAt: string;
}): BookingStatusHistoryResponse {
  return {
    id: options.id,
    bookingId: BOOKING_ID,
    oldStatus: options.oldStatus,
    newStatus: options.newStatus,
    changedByAdminUserId: options.actorUserId,
    actorDisplayName: options.actorDisplayName,
    actorType: options.actorType,
    notes: options.notes,
    changedAt: options.changedAt,
  };
}

async function installFixtureApi(page: Page, state: FixtureState) {
  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }

    if (url.pathname === "/api/auth/refresh") {
      const admin = admins[state.currentAdminId];
      await fulfillEnvelope(route, {
        accessToken: `sanitized-token-${admin.id}`,
        expiresInSeconds: 3600,
        subjectType: "Admin",
        adminRole: "SuperAdmin",
        roleName: "Super Admin",
        user: {
          userId: admin.id,
          identifier: admin.email,
          subjectType: "Admin",
          adminRole: "SuperAdmin",
          name: admin.name,
        },
        permissions: [
          "bookings:read",
          "bookings:write",
          "clients:read",
          "units:read",
        ],
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

    if (url.pathname === "/api/internal/admin-directory") {
      await fulfillEnvelope(
        route,
        Object.values(admins).map((admin) => ({
          ...admin,
          roleName: "Super Admin",
          isActive: true,
        }))
      );
      return;
    }

    if (url.pathname === "/api/internal/bookings/quick" && request.method() === "POST") {
      const payload = request.postDataJSON() as CreateBookingRequest;
      state.creationPayloads.push(payload);
      state.booking = bookingFromRequest(payload);
      const creator = admins[state.currentAdminId];
      state.history = [
        historyEntry({
          id: "70000000-0000-4000-8000-000000000001",
          oldStatus: null,
          newStatus: "Prospecting",
          actorUserId: creator.id,
          actorDisplayName: creator.name,
          actorType: "admin",
          notes: "Booking created",
          changedAt: state.booking.createdAt,
        }),
      ];
      await fulfillEnvelope(route, state.booking);
      return;
    }

    if (url.pathname === "/api/internal/bookings" && request.method() === "GET") {
      await fulfillEnvelope(route, state.booking ? [state.booking] : [], {
        pagination: {
          totalCount: state.booking ? 1 : 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      });
      return;
    }

    if (
      url.pathname === `/api/internal/bookings/${BOOKING_ID}/relevant` &&
      request.method() === "POST"
    ) {
      if (!state.booking) {
        await fulfillEnvelope(route, null, { status: 404 });
        return;
      }
      const actor = admins[state.currentAdminId];
      const payload = request.postDataJSON() as { notes?: string };
      state.booking = {
        ...state.booking,
        bookingStatus: "Relevant",
        updatedAt: "2026-07-24T09:00:00.000Z",
      };
      state.history = [
        historyEntry({
          id: "70000000-0000-4000-8000-000000000002",
          oldStatus: "Prospecting",
          newStatus: "Relevant",
          actorUserId: actor.id,
          actorDisplayName: actor.name,
          actorType: "admin",
          notes: payload.notes ?? "Status changed",
          changedAt: state.booking.updatedAt,
        }),
        ...state.history,
      ];
      await fulfillEnvelope(route, state.booking);
      return;
    }

    if (url.pathname === `/api/internal/bookings/${BOOKING_ID}/status-history`) {
      state.historyRequests += 1;
      await fulfillEnvelope(route, state.history);
      return;
    }

    if (url.pathname === `/api/internal/bookings/${BOOKING_ID}`) {
      await fulfillEnvelope(route, state.booking, {
        status: state.booking ? 200 : 404,
      });
      return;
    }

    if (url.pathname === `/api/internal/bookings/${BOOKING_ID}/finance-snapshot`) {
      await fulfillEnvelope(route, {
        bookingId: BOOKING_ID,
        remainingAmount: 2_000,
        invoicedAmount: 0,
        paidAmount: 0,
        invoiceId: null,
        invoiceStatus: null,
        ownerPayoutStatus: null,
      });
      return;
    }

    if (url.pathname === `/api/internal/bookings/${BOOKING_ID}/notes`) {
      await fulfillEnvelope(route, []);
      return;
    }

    if (url.pathname === `/api/internal/bookings/${BOOKING_ID}/assignment`) {
      await fulfillEnvelope(route, null);
      return;
    }

    if (url.pathname === "/api/internal/units" && request.method() === "GET") {
      await fulfillEnvelope(
        route,
        [
          {
            id: UNIT_ID,
            ownerId: OWNER_ID,
            ownerName: "Sanitized Owner",
            projectId: PROJECT_ID,
            projectName: "Sanitized Project",
            name: "Sanitized Unit",
            unitType: "studio",
            bedrooms: 1,
            bathrooms: 1,
            maxGuests: 3,
            basePricePerNight: 1_000,
            isActive: true,
            isVisibleInPortfolio: true,
            createdAt: "2026-07-01T08:00:00.000Z",
          },
        ],
        {
          pagination: {
            totalCount: 1,
            page: 1,
            pageSize: 500,
            totalPages: 1,
          },
        }
      );
      return;
    }

    if (url.pathname === `/api/internal/units/${UNIT_ID}`) {
      await fulfillEnvelope(route, {
        id: UNIT_ID,
        ownerId: OWNER_ID,
        ownerName: "Sanitized Owner",
        projectId: PROJECT_ID,
        projectName: "Sanitized Project",
        name: "Sanitized Unit",
        description: "Sanitized unit used only for local QA.",
        address: "Sanitized address",
        unitType: "studio",
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 3,
        basePricePerNight: 1_000,
        isActive: true,
        isVisibleInPortfolio: true,
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T08:00:00.000Z",
        images: [],
        amenities: [],
      });
      return;
    }

    if (
      url.pathname === `/api/units/${UNIT_ID}/availability/operational-check`
    ) {
      await fulfillEnvelope(route, {
        unitId: UNIT_ID,
        startDate: url.searchParams.get("startDate"),
        endDate: url.searchParams.get("endDate"),
        isAvailable: true,
        reason: null,
        blockedDates: [],
        heldDates: [],
      });
      return;
    }

    if (url.pathname === "/api/clients" && request.method() === "GET") {
      await fulfillEnvelope(
        route,
        [
          {
            id: CLIENT_ID,
            name: "Sanitized Client",
            phone: "+201000000003",
            email: "client@example.test",
            isActive: true,
            createdAt: "2026-07-01T08:00:00.000Z",
          },
        ],
        {
          pagination: {
            totalCount: 1,
            page: 1,
            pageSize: 500,
            totalPages: 1,
          },
        }
      );
      return;
    }

    if (url.pathname === `/api/clients/${CLIENT_ID}`) {
      await fulfillEnvelope(route, {
        id: CLIENT_ID,
        name: "Sanitized Client",
        phone: "+201000000003",
        email: "client@example.test",
        isActive: true,
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T08:00:00.000Z",
      });
      return;
    }

    if (url.pathname === "/api/internal/payments") {
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

    await fulfillEnvelope(route, null, { status: 404 });
  });
}

async function resetSessionFor(page: Page, state: FixtureState, adminId: keyof typeof admins) {
  state.currentAdminId = adminId;
  await page.evaluate(() => localStorage.removeItem("kaza-auth"));
  await page.reload();
}

async function openBooking(page: Page) {
  await page.goto(`/admin/bookings/${BOOKING_ID}`);
  await expect(
    page.getByRole("heading", { name: "Status History", level: 3 })
  ).toBeVisible({ timeout: 15_000 });
}

function statusHistoryPanel(page: Page): Locator {
  return page
    .getByRole("heading", { name: "Status History", level: 3 })
    .locator("..");
}

async function captureScreenshot(page: Page, name: string) {
  if (process.env.BOOKING_HISTORY_CAPTURE_SCREENSHOTS !== "1") return;
  const directory = path.resolve(
    process.cwd(),
    "..",
    "docs",
    "qa",
    "booking-history-creator"
  );
  fs.mkdirSync(directory, { recursive: true });
  const panel = statusHistoryPanel(page);
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: path.join(directory, `${name}.png`) });
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
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([
    {
      name: "refresh_token",
      value: "sanitized-local-refresh-token",
      url: "http://localhost:3103",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test.afterEach(async ({ page }) => {
  const unexpectedIssues = (runtimeIssues.get(page) ?? []).filter(
    (issue) =>
      !(
        issue.startsWith("requestfailed:") &&
        issue.includes("_rsc=") &&
        issue.includes("net::ERR_ABORTED")
      )
  );
  expect(unexpectedIssues).toEqual([]);
});

test("Admin A remains the creator when Admin B views and updates the booking", async ({
  page,
}) => {
  const state = createState();
  await installFixtureApi(page, state);

  await page.goto("/admin/bookings");
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Bookings", level: 1 })
  ).toBeVisible();
  await page.getByRole("button", { name: "Quick Booking" }).click();
  await page
    .getByRole("button", { name: "Select check-in and check-out" })
    .click();
  const dateDialog = page.getByRole("dialog", { name: "Stay dates" });
  await dateDialog.getByRole("button", { name: /August 10.*2026/i }).click();
  await dateDialog.getByRole("button", { name: /August 12.*2026/i }).click();
  await expect(page.getByText("1 unit available")).toBeVisible();
  await page.getByRole("button", { name: /Sanitized Unit/ }).click();
  await page.getByRole("button", { name: "Select client" }).click();
  await page.getByText("Sanitized Client - +201000000003").click();
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page.getByRole("dialog", { name: "Quick Booking" })).toBeHidden();

  const creationPayload = AssertSingle(state.creationPayloads);
  expect(creationPayload).not.toHaveProperty("createdByAdminUserId");
  expect(creationPayload).not.toHaveProperty("actorUserId");
  expect(creationPayload).not.toHaveProperty("changedByAdminUserId");

  await openBooking(page);
  let historyPanel = statusHistoryPanel(page);
  await expect(historyPanel.getByText(admins[ADMIN_A_ID].name)).toBeVisible();
  await expect(historyPanel.getByText("Unknown Admin")).toHaveCount(0);
  await captureScreenshot(page, "admin-a-created");

  await resetSessionFor(page, state, ADMIN_B_ID);
  await expect(page.getByText("admin-b@example.test", { exact: true })).toBeVisible();
  historyPanel = statusHistoryPanel(page);
  await expect(historyPanel.getByText(admins[ADMIN_A_ID].name)).toBeVisible();
  await expect(historyPanel.getByText("Unknown Admin")).toHaveCount(0);

  await page.getByRole("button", { name: "Mark as relevant" }).click();
  const transitionDialog = page.getByRole("dialog", { name: "Mark as Relevant" });
  await transitionDialog
    .getByLabel("Internal note (optional)")
    .fill("Sanitized follow-up completed.");
  await transitionDialog
    .getByRole("button", { name: "Mark as Relevant" })
    .click();
  await expect(
    historyPanel.getByText("Sanitized follow-up completed.")
  ).toBeVisible();
  await expect(historyPanel.getByText(admins[ADMIN_A_ID].name)).toBeVisible();
  await expect(
    historyPanel.getByText("Sanitized Admin B", { exact: true })
  ).toBeVisible();

  const requestsBeforeRefresh = state.historyRequests;
  await page.reload();
  historyPanel = statusHistoryPanel(page);
  await expect(historyPanel.getByText(admins[ADMIN_A_ID].name)).toBeVisible();
  await expect(
    historyPanel.getByText("Sanitized follow-up completed.")
  ).toBeVisible();
  expect(state.historyRequests).toBeGreaterThan(requestsBeforeRefresh);
  expect(state.history).toHaveLength(2);
  await captureScreenshot(page, "admin-b-view-and-update");
});

test("renders system and unavailable actors without leaking ids or Unknown Admin", async ({
  page,
}) => {
  const state = createState();
  state.booking = bookingFromRequest({
    clientId: CLIENT_ID,
    unitId: UNIT_ID,
    checkInDate: "2026-08-10",
    checkOutDate: "2026-08-12",
    guestCount: 2,
    source: "website",
  });
  state.history = [
    historyEntry({
      id: "70000000-0000-4000-8000-000000000004",
      oldStatus: "CheckIn",
      newStatus: "Completed",
      actorUserId: null,
      actorDisplayName: "System",
      actorType: "system",
      notes: "Automatically completed.",
      changedAt: "2026-07-24T11:00:00.000Z",
    }),
    historyEntry({
      id: "70000000-0000-4000-8000-000000000003",
      oldStatus: "Relevant",
      newStatus: "Booked",
      actorUserId: null,
      actorDisplayName: "Actor unavailable",
      actorType: "unavailable",
      notes: "Historical actor was not recorded.",
      changedAt: "2026-07-24T10:00:00.000Z",
    }),
    historyEntry({
      id: "70000000-0000-4000-8000-000000000001",
      oldStatus: null,
      newStatus: "Prospecting",
      actorUserId: ADMIN_A_ID,
      actorDisplayName: admins[ADMIN_A_ID].name,
      actorType: "admin",
      notes: "Booking created",
      changedAt: "2026-07-24T08:00:00.000Z",
    }),
    historyEntry({
      id: "70000000-0000-4000-8000-000000000005",
      oldStatus: null,
      newStatus: "Prospecting",
      actorUserId: null,
      actorDisplayName: "",
      actorType: "unavailable",
      notes: "Legacy creation actor was not returned.",
      changedAt: "2026-07-24T07:00:00.000Z",
    }),
  ];
  await installFixtureApi(page, state);
  await openBooking(page);

  const historyPanel = statusHistoryPanel(page);
  await expect(historyPanel.getByText(admins[ADMIN_A_ID].name)).toBeVisible();
  await expect(historyPanel.getByText("System", { exact: true })).toBeVisible();
  await expect(
    historyPanel.getByText("Actor unavailable", { exact: true })
  ).toBeVisible();
  await expect(
    historyPanel.getByText("Creator unavailable", { exact: true })
  ).toBeVisible();
  await expect(historyPanel.getByText("Unknown Admin")).toHaveCount(0);
  await expect(historyPanel.getByText(ADMIN_A_ID)).toHaveCount(0);
});

function AssertSingle<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  return items[0]!;
}
