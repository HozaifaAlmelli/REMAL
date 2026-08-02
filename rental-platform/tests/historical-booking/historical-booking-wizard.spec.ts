import { expect, test, type Page, type Route } from "@playwright/test";

const API_ORIGIN = "http://historical-fixture.local";
const ADMIN_ID = "10000000-0000-4000-8000-000000000001";
const UNIT_ID = "50000000-0000-4000-8000-000000000001";
const CLIENT_ID = "40000000-0000-4000-8000-000000000001";
const BOOKING_ID = "60000000-0000-4000-8000-000000000001";
const OWNER_ID = "70000000-0000-4000-8000-000000000001";
const PAYMENT_ID = "80000000-0000-4000-8000-000000000001";

type OwnerMode =
  | "success"
  | "review-required"
  | "forbidden"
  | "not-found"
  | "server-error"
  | "delayed";

interface FixtureState {
  bookingPosts: Array<{ body: Record<string, unknown>; key: string }>;
  ownerGets: string[];
  correctionCalls: number;
  paymentPosts: Array<{ body: Record<string, unknown>; key: string }>;
  invoiceCalls: number;
  payoutCalls: number;
  notificationWrites: number;
  ownerMode: OwnerMode;
  releaseOwnerReview: (() => void) | null;
  bookingResponseLoss: boolean;
  committedBooking: boolean;
  paymentResponseLoss: boolean;
  committedPayment: boolean;
  permissions: string[];
}

const cors = {
  "access-control-allow-origin": "http://localhost:3103",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers":
    "Content-Type, Authorization, Idempotency-Key",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

async function envelope(
  route: Route,
  data: unknown,
  options: {
    status?: number;
    code?: string;
    message?: string;
    pagination?: unknown;
  } = {}
) {
  const status = options.status ?? 200;
  await route.fulfill({
    status,
    headers: { ...cors, "content-type": "application/json" },
    body: JSON.stringify({
      success: status < 400,
      data: status < 400 ? data : null,
      message: options.message ?? null,
      errors: [],
      code: options.code ?? null,
      metadata: null,
      pagination: options.pagination ?? null,
    }),
  });
}

async function installApi(
  page: Page,
  options: Partial<FixtureState> = {}
): Promise<FixtureState> {
  const state: FixtureState = {
    bookingPosts: [],
    ownerGets: [],
    correctionCalls: 0,
    paymentPosts: [],
    invoiceCalls: 0,
    payoutCalls: 0,
    notificationWrites: 0,
    ownerMode: "success",
    releaseOwnerReview: null,
    bookingResponseLoss: false,
    committedBooking: false,
    paymentResponseLoss: false,
    committedPayment: false,
    permissions: [
      "bookings:read",
      "bookings:record_historical",
      "payments:record_historical",
      "units:read",
      "clients:read",
    ],
    ...options,
  };

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.pathname === "/api/auth/refresh") {
      await envelope(route, {
        accessToken: "sanitized-access-token",
        expiresInSeconds: 3600,
        subjectType: "Admin",
        adminRole: "SuperAdmin",
        roleName: "Super Admin",
        user: {
          userId: ADMIN_ID,
          identifier: "operator@example.test",
          subjectType: "Admin",
          adminRole: "SuperAdmin",
          name: "Historical Operator",
        },
        permissions: state.permissions,
      });
      return;
    }
    if (url.pathname === "/api/internal/me/notifications/inbox/summary") {
      await envelope(route, { totalCount: 0, unreadCount: 0, readCount: 0 });
      return;
    }
    if (url.pathname === "/api/internal/units" && request.method() === "GET") {
      await envelope(
        route,
        [
          {
            id: UNIT_ID,
            ownerId: OWNER_ID,
            ownerName: "not rendered in attribution",
            projectId: "90000000-0000-4000-8000-000000000001",
            projectName: "Sanitized Project",
            name: "Sanitized Historical Unit",
            unitType: "chalet",
            bedrooms: 2,
            bathrooms: 2,
            maxGuests: 4,
            basePricePerNight: 2500,
            isActive: false,
            isVisibleInPortfolio: false,
            createdAt: "2025-01-01T00:00:00Z",
          },
        ],
        { pagination: { page: 1, pageSize: 100, totalCount: 1, totalPages: 1 } }
      );
      return;
    }
    if (url.pathname === "/api/clients" && request.method() === "GET") {
      await envelope(
        route,
        [
          {
            id: CLIENT_ID,
            name: "Sanitized Existing Client",
            phone: "+201000000001",
            email: "client@example.test",
            isActive: true,
            createdAt: "2025-01-01T00:00:00Z",
          },
        ],
        { pagination: { page: 1, pageSize: 100, totalCount: 1, totalPages: 1 } }
      );
      return;
    }
    if (
      url.pathname === "/api/internal/bookings/historical" &&
      request.method() === "POST"
    ) {
      state.bookingPosts.push({
        body: request.postDataJSON() as Record<string, unknown>,
        key: request.headers()["idempotency-key"] ?? "",
      });
      state.committedBooking = true;
      if (state.bookingResponseLoss && state.bookingPosts.length === 1) {
        await route.abort("connectionreset");
        return;
      }
      await envelope(route, {
        id: BOOKING_ID,
        clientId: CLIENT_ID,
        unitId: UNIT_ID,
        unitName: "Sanitized Historical Unit",
        ownerId: OWNER_ID,
        assignedAdminUserId: null,
        assignedAdminUserName: null,
        assignedAdminUserRole: null,
        bookingStatus: "Completed",
        checkInDate: "2026-06-10",
        checkOutDate: "2026-06-13",
        guestCount: 2,
        baseAmount: 3900,
        finalAmount: 3900,
        source: "admin",
        internalNotes: null,
        createdAt: "2026-08-02T10:00:00Z",
        updatedAt: "2026-08-02T10:00:00Z",
        isHistorical: true,
        actualBookedAt: "2026-06-01",
        historicalEntryReason: "offline_booking_recorded_after_stay",
        historicalEntryNote: null,
        originalSource: "offline_record",
        originalSourceLabel: "Offline record",
        externalReference: null,
        agreedAmount: 3900,
        recordedAt: "2026-08-02T10:00:00Z",
        recordedByAdminUserId: ADMIN_ID,
        idempotencyKey: state.bookingPosts[0]!.key,
        statusHistoryEventId: "30000000-0000-4000-8000-000000000001",
      });
      return;
    }
    if (
      url.pathname ===
      `/api/internal/bookings/${BOOKING_ID}/owner-attribution-review`
    ) {
      state.ownerGets.push(url.pathname);
      if (state.ownerMode === "delayed") {
        await new Promise<void>((resolve) => {
          state.releaseOwnerReview = resolve;
        });
      }
      if (state.ownerMode === "review-required") {
        await envelope(route, null, {
          status: 409,
          code: "OWNER_ATTRIBUTION_REQUIRES_REVIEW",
          message: "Review required",
        });
      } else if (state.ownerMode === "forbidden") {
        await envelope(route, null, { status: 403, message: "Forbidden" });
      } else if (state.ownerMode === "not-found") {
        await envelope(route, null, {
          status: 404,
          code: "OWNER_CORRECTION_BOOKING_NOT_FOUND",
          message: "Missing",
        });
      } else if (state.ownerMode === "server-error") {
        await envelope(route, null, { status: 500, message: "Unavailable" });
      } else {
        await envelope(route, {
          bookingId: BOOKING_ID,
          currentOwnerId: OWNER_ID,
          canCorrect: true,
          payoutReviewRequired: false,
          warnings: ["CURRENT_OWNER_INACTIVE"],
        });
      }
      return;
    }
    if (url.pathname.includes("owner-attribution-corrections")) {
      state.correctionCalls += 1;
      await envelope(route, null, { status: 500 });
      return;
    }
    if (
      url.pathname ===
        `/api/internal/bookings/${BOOKING_ID}/historical-payments` &&
      request.method() === "POST"
    ) {
      state.paymentPosts.push({
        body: request.postDataJSON() as Record<string, unknown>,
        key: request.headers()["idempotency-key"] ?? "",
      });
      state.committedPayment = true;
      if (state.paymentResponseLoss && state.paymentPosts.length === 1) {
        await route.abort("connectionreset");
        return;
      }
      await envelope(route, {
        paymentId: PAYMENT_ID,
        bookingId: BOOKING_ID,
        amount: 1000,
        paymentMethod: "cash",
        paidAt: "2026-07-15T07:30:00Z",
        referenceNumber: "LEGACY-123",
        reason: "Verified legacy receipt",
        isHistoricalRecord: true,
        recordedByAdminUserId: ADMIN_ID,
        recordedAt: "2026-08-02T10:10:00Z",
        historyEventId: "30000000-0000-4000-8000-000000000002",
      });
      return;
    }
    if (url.pathname.includes("invoice")) state.invoiceCalls += 1;
    if (url.pathname.includes("payout")) state.payoutCalls += 1;
    if (url.pathname.includes("notification") && request.method() !== "GET")
      state.notificationWrites += 1;
    await envelope(route, null, {
      status: 404,
      message: "Fixture route not found",
    });
  });
  return state;
}

async function reachStepSix(page: Page) {
  await page.goto("/admin/bookings/historical/new");
  await expect(
    page.getByRole("heading", { name: "Record historical booking" })
  ).toBeVisible();
  await page.getByLabel("Original source").selectOption("offline_record");
  await page.getByLabel("Original booking date").fill("2026-06-01");
  await page
    .getByLabel("Entry reason")
    .selectOption("offline_booking_recorded_after_stay");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Unit", exact: true }).click();
  await page
    .getByText("Sanitized Historical Unit · Sanitized Project · Inactive", {
      exact: true,
    })
    .click();
  await page.getByLabel("Check-in date").fill("2026-06-10");
  await page.getByLabel("Check-out date").fill("2026-06-13");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Existing client").click();
  await page
    .getByText("Sanitized Existing Client · +201000000001", { exact: true })
    .click();
  await page.getByLabel("Guests").fill("2");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Agreed amount (EGP)").fill("3900.00");
  await page.getByRole("button", { name: "Continue" }).click();
}

test("Step 5 is policy-only and post-create review uses the returned booking ID", async ({
  page,
}) => {
  const state = await installApi(page, { ownerMode: "delayed" });
  await page.goto("/admin/bookings/historical/new");
  await expect(
    page
      .getByRole("navigation", { name: "Historical booking steps" })
      .getByRole("button")
      .nth(5)
  ).toBeDisabled();
  await reachStepSix(page);
  await expect(
    page.getByRole("heading", { name: "Owner review" })
  ).toBeVisible();
  await expect(
    page.getByText("This step does not look up or predict an owner.")
  ).toBeVisible();
  expect(state.ownerGets).toHaveLength(0);
  expect(state.bookingPosts).toHaveLength(0);
  await expect(page.getByText(OWNER_ID)).toHaveCount(0);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Review and create" })
  ).toBeVisible();
  expect(state.ownerGets).toHaveLength(0);
  await page
    .getByRole("button", { name: "Record historical booking" })
    .dblclick();

  await expect(page.getByText("Historical booking created")).toBeVisible();
  await expect(page.getByTestId("booking-created-state")).toContainText(
    BOOKING_ID
  );
  expect(state.bookingPosts).toHaveLength(1);
  expect(state.ownerGets).toEqual([
    `/api/internal/bookings/${BOOKING_ID}/owner-attribution-review`,
  ]);
  const payload = state.bookingPosts[0]!.body;
  for (const forbidden of [
    "ownerId",
    "ownerReview",
    "ownerPolicyAcknowledged",
    "payment",
    "actorId",
  ]) {
    expect(payload).not.toHaveProperty(forbidden);
  }
  expect(state.correctionCalls).toBe(0);
  state.releaseOwnerReview?.();
  await expect(page.getByText(OWNER_ID)).toBeVisible();
  await expect(page.getByText("CURRENT_OWNER_INACTIVE")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

for (const example of [
  [
    "review-required",
    "Owner attribution requires a separate operational review.",
  ],
  [
    "forbidden",
    "Owner-attribution details are unavailable to the current user.",
  ],
  [
    "not-found",
    "The booking was created, but its owner review could not be located.",
  ],
] as const) {
  test(`${example[0]} owner review preserves booking success`, async ({
    page,
  }) => {
    const state = await installApi(page, { ownerMode: example[0] });
    await reachStepSix(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await page
      .getByRole("button", { name: "Record historical booking" })
      .click();
    await expect(page.getByText("Historical booking created")).toBeVisible();
    await expect(page.getByText(example[1], { exact: false })).toBeVisible();
    expect(state.bookingPosts).toHaveLength(1);
    expect(state.correctionCalls).toBe(0);
  });
}

test("owner GET retry never reposts booking and optional payment remains independent", async ({
  page,
}) => {
  const state = await installApi(page, { ownerMode: "server-error" });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  await expect(
    page.getByText("Owner attribution review is temporarily unavailable.", {
      exact: false,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Optional payment evidence" })
  ).toBeVisible();
  state.ownerMode = "success";
  await page.getByRole("button", { name: "Retry owner review" }).click();
  await expect(page.getByText(OWNER_ID)).toBeVisible();
  expect(state.bookingPosts).toHaveLength(1);
  expect(state.ownerGets).toHaveLength(2);
});

test("booking timeout recovery reuses the booking key then starts owner review", async ({
  page,
}) => {
  const state = await installApi(page, { bookingResponseLoss: true });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Booking not created")).toBeVisible();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  expect(state.bookingPosts).toHaveLength(2);
  expect(state.bookingPosts[0]!.key).toBe(state.bookingPosts[1]!.key);
  expect(state.ownerGets).toEqual([
    `/api/internal/bookings/${BOOKING_ID}/owner-attribution-review`,
  ]);
  await page.reload();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  expect(state.bookingPosts).toHaveLength(2);
  expect(state.ownerGets).toHaveLength(2);
});

test("payment timeout recovery uses its own key and never reposts booking", async ({
  page,
}) => {
  const state = await installApi(page, {
    paymentResponseLoss: true,
    ownerMode: "forbidden",
  });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  await page.getByLabel("Amount (EGP)").fill("1000.00");
  await page.getByLabel("Payment method").selectOption("cash");
  await page.getByLabel("Paid at").fill("2026-07-15T10:30");
  await page.getByLabel("Reference (optional)").fill("LEGACY-123");
  await page.getByLabel("Recording reason").fill("Verified legacy receipt");
  await page.getByRole("button", { name: "Record payment evidence" }).click();
  await expect(page.getByText("Booking remains created")).toBeVisible();
  await page.getByRole("button", { name: "Record payment evidence" }).click();
  await expect(page.getByText("Payment evidence recorded")).toBeVisible();
  expect(state.bookingPosts).toHaveLength(1);
  expect(state.paymentPosts).toHaveLength(2);
  expect(state.paymentPosts[0]!.key).toBe(state.paymentPosts[1]!.key);
  expect(state.paymentPosts[0]!.key).not.toBe(state.bookingPosts[0]!.key);
  expect(state.invoiceCalls).toBe(0);
  expect(state.payoutCalls).toBe(0);
  expect(state.notificationWrites).toBe(0);
  expect(state.correctionCalls).toBe(0);
});

test("wizard route and booking-list action require the dedicated permission", async ({
  page,
}) => {
  await installApi(page, {
    permissions: ["bookings:read", "units:read", "clients:read"],
  });
  await page.goto("/admin/bookings");
  await expect(
    page.getByRole("button", { name: "Record historical" })
  ).toHaveCount(0);
  await page.goto("/admin/bookings/historical/new");
  await expect(page).toHaveURL(/\/admin\/bookings$/);
});
