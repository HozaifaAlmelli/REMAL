import { expect, test, type Page, type Route } from "@playwright/test";

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
  refreshCalls: number;
  refreshPermissionResponses: string[][];
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
    metadata?: unknown;
    errors?: string[];
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
      errors: options.errors ?? [],
      code: options.code ?? null,
      metadata: options.metadata ?? null,
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
    refreshCalls: 0,
    refreshPermissionResponses: [],
    ...options,
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.pathname === "/api/auth/refresh") {
      state.refreshCalls += 1;
      const permissions =
        state.refreshPermissionResponses.shift() ?? state.permissions;
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
        permissions,
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

  await page.getByRole("combobox", { name: "Unit", exact: true }).click();
  await page
    .getByText("Sanitized Historical Unit · Sanitized Project · Inactive", {
      exact: true,
    })
    .click();
  await page.getByLabel("Check-in date").fill("2026-06-10");
  await page.getByLabel("Check-out date").fill("2026-06-13");
  await page.getByRole("button", { name: "Continue" }).click();

  await page
    .getByRole("combobox", { name: "Existing client", exact: true })
    .click();
  await page
    .getByText("Sanitized Existing Client · +201000000001", { exact: true })
    .click();
  await page.getByLabel("Guests").fill("2");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Agreed amount (EGP)").fill("3900.00");
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillHistoricalPayment(
  page: Page,
  method: "cash" | "bank_transfer" | "card" | "wallet" = "cash"
) {
  await page.getByLabel("Amount (EGP)").fill("1000.00");
  await page.getByLabel("Payment method").selectOption(method);
  await page.getByLabel("Paid at").fill("2026-07-15T10:30");
  await page.getByLabel("Reference (optional)").fill("LEGACY-123");
  await page.getByLabel("Recording reason").fill("Verified legacy receipt");
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
  await expect.poll(() => state.releaseOwnerReview !== null).toBe(true);
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
  await expect(page.getByText("Booking outcome unknown")).toBeVisible();
  await page
    .getByRole("button", { name: "Retry unchanged booking command" })
    .click();
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
  await expect(page.getByText("Payment outcome unknown")).toBeVisible();
  await page
    .getByRole("button", { name: "Retry unchanged payment command" })
    .click();
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

test("wizard refreshes a stale permission projection before redirecting", async ({
  page,
}) => {
  const state = await installApi(page, {
    refreshPermissionResponses: [
      ["bookings:read", "units:read", "clients:read"],
      [
        "bookings:read",
        "bookings:record_historical",
        "payments:record_historical",
        "units:read",
        "clients:read",
      ],
    ],
  });

  await page.goto("/admin/bookings/historical/new");

  await expect(page).toHaveURL(/\/admin\/bookings\/historical\/new$/);
  await expect(
    page.getByRole("heading", { name: "Record historical booking" })
  ).toBeVisible();
  expect(state.refreshCalls).toBe(2);
});

test("authorized booking-list action enters the admin historical wizard", async ({
  page,
}) => {
  await installApi(page);
  await page.goto("/admin/bookings");
  await page.getByRole("button", { name: "Record historical" }).click();
  await expect(page).toHaveURL(/\/admin\/bookings\/historical\/new$/);
  await expect(
    page.getByRole("heading", { name: "Record historical booking" })
  ).toBeVisible();
});

test("shared combobox supports a keyboard-only path with complete ARIA relationships", async ({
  page,
}) => {
  const state = await installApi(page);
  await page.goto("/admin/bookings/historical/new");
  const stepButtons = page
    .getByRole("navigation", { name: "Historical booking steps" })
    .getByRole("button");
  const stepNames = [
    "Provenance",
    "Unit & occupied dates",
    "Client & stay details",
    "Financial truth",
    "Owner review",
    "Review & create",
  ];
  await expect(stepButtons).toHaveCount(6);
  for (const [index, name] of stepNames.entries()) {
    await expect(stepButtons.nth(index)).toHaveAccessibleName(name);
  }

  await page.getByLabel("Original source").selectOption("offline_record");
  await page.getByLabel("Original booking date").fill("2026-06-01");
  await page
    .getByLabel("Entry reason")
    .selectOption("offline_booking_recorded_after_stay");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");

  const unit = page.getByRole("combobox", { name: "Unit", exact: true });
  await expect(unit).toHaveAttribute("aria-expanded", "false");
  await expect(unit).toHaveAttribute("aria-haspopup", "listbox");
  const listboxId = await unit.getAttribute("aria-controls");
  expect(listboxId).toBeTruthy();
  await unit.focus();
  await page.keyboard.press("Enter");
  await expect(unit).toHaveAttribute("aria-expanded", "true");
  const unitSearch = page.getByRole("searchbox", { name: "Search Unit" });
  await expect(unitSearch).toBeFocused();
  await expect(page.locator(`#${listboxId}`)).toHaveRole("listbox");
  await page.keyboard.press("End");
  await expect(unitSearch).toHaveAttribute("aria-activedescendant", /option-/);
  await page.keyboard.press("Escape");
  await expect(unit).toBeFocused();
  await expect(unit).toContainText("Search unit or project");

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(unit).toContainText("Sanitized Historical Unit");
  const clearUnit = page.getByRole("button", { name: "Clear Unit" });
  await clearUnit.focus();
  await page.keyboard.press("Enter");
  await expect(unit).toContainText("Search unit or project");
  await unit.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press(" ");
  await expect(unit).toContainText("Sanitized Historical Unit");

  await page.getByLabel("Check-in date").fill("2026-06-10");
  await page.getByLabel("Check-out date").fill("2026-06-13");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  const client = page.getByRole("combobox", {
    name: "Existing client",
    exact: true,
  });
  await client.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("searchbox", { name: "Search Existing client" })
  ).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await page.getByLabel("Guests").fill("2");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Agreed amount (EGP)").fill("3900.00");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("owner-policy-step")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Review and create" })).toBeVisible();
  await expect(page.getByText("Offline record", { exact: true })).toBeVisible();
  await expect(page.getByText(CLIENT_ID, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record historical booking" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Historical booking created")).toBeVisible();
  expect(state.bookingPosts[0]?.body).toMatchObject({
    originalSource: "offline_record",
    historicalEntryReason: "offline_booking_recorded_after_stay",
    unitId: UNIT_ID,
    clientId: CLIENT_ID,
    checkInDate: "2026-06-10",
    checkOutDate: "2026-06-13",
    guestCount: 2,
    agreedAmount: 3900,
    acknowledgedDuplicateOf: [],
    acknowledgedDateBlockIds: [],
  });
});

test("submit validation routes to the first invalid composite control and links its error", async ({
  page,
}) => {
  await installApi(page);
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("button", { name: "Unit & occupied dates" })
    .click();
  await page.getByRole("button", { name: "Clear Unit" }).click();
  await page.getByRole("button", { name: "Review & create" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  const unit = page.getByRole("combobox", { name: "Unit", exact: true });
  await expect(page.getByRole("heading", { name: "Unit and occupied dates" })).toBeVisible();
  await expect(unit).toBeFocused();
  await expect(unit).toHaveAttribute("aria-invalid", "true");
  await expect(unit).toHaveAttribute("aria-describedby", "historical-unit-error");
  await expect(page.locator("#historical-unit-error")).toHaveText("Select a unit.");

  await unit.click();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Client & stay details" }).click();
  await page.getByRole("button", { name: "Clear Existing client" }).click();
  await page.getByRole("button", { name: "Review & create" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  const client = page.getByRole("combobox", {
    name: "Existing client",
    exact: true,
  });
  await expect(page.getByRole("heading", { name: "Client and stay details" })).toBeVisible();
  await expect(client).toBeFocused();
  await expect(client).toHaveAttribute("aria-describedby", "historical-client-error");
});

test("conflict acknowledgements are exact, visible, and invalidated by semantic edits", async ({
  page,
}) => {
  const candidateOne = "91000000-0000-4000-8000-000000000001";
  const candidateTwo = "91000000-0000-4000-8000-000000000002";
  const candidateThree = "91000000-0000-4000-8000-000000000003";
  const outgoing: Array<Record<string, unknown>> = [];
  await installApi(page);
  await page.route("**/api/internal/bookings/historical", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    outgoing.push(body);
    const candidate =
      body.checkOutDate === "2026-06-13"
        ? candidateOne
        : body.clientId
          ? candidateTwo
          : candidateThree;
    const acknowledged = body.acknowledgedDuplicateOf as string[];
    if (acknowledged.length !== 1 || acknowledged[0] !== candidate) {
      await envelope(route, null, {
        status: 409,
        code: "HISTORICAL_DUPLICATE_BOOKING",
        message: "Probable duplicate",
        metadata: {
          candidates: [
            {
              bookingId: candidate,
              status: "Prospecting",
              checkInDate: "2026-06-10",
              checkOutDate: String(body.checkOutDate),
            },
          ],
          requiresAcknowledgement: true,
        },
      });
      return;
    }
    await route.fallback();
  });

  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await page.getByRole("button", { name: "Acknowledge exact IDs" }).click();
  await expect(page.getByText(candidateOne, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Unit & occupied dates" }).click();
  await page.getByLabel("Check-out date").fill("2026-06-14");
  await page.getByRole("button", { name: "Review & create" }).click();
  await expect(page.getByText(candidateOne, { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Record historical booking" }).click();
  expect(outgoing[1]?.acknowledgedDuplicateOf).toEqual([]);
  expect(outgoing[1]?.acknowledgedDateBlockIds).toEqual([]);
  await page.getByRole("button", { name: "Acknowledge exact IDs" }).click();
  await expect(page.getByText(candidateTwo, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Unit & occupied dates" }).click();
  await page.getByRole("button", { name: "Clear Unit" }).click();
  const unit = page.getByRole("combobox", { name: "Unit", exact: true });
  await unit.click();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Client & stay details" }).click();
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Client name").fill("Sanitized New Client");
  await page.getByLabel("Phone").fill("+201000000002");
  await page.getByLabel("Email (optional)").fill("new@example.test");
  await page.getByRole("button", { name: "Review & create" }).click();
  await expect(page.getByText(candidateTwo, { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Record historical booking" }).click();
  expect(outgoing[2]?.acknowledgedDuplicateOf).toEqual([]);
  await page.getByRole("button", { name: "Acknowledge exact IDs" }).click();
  await expect(page.getByText(candidateThree, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  expect(outgoing[3]?.acknowledgedDuplicateOf).toEqual([candidateThree]);
});

test("exact duplicates use the scalar ID and hard overlaps cannot be acknowledged", async ({
  page,
}) => {
  const duplicateId = "92000000-0000-4000-8000-000000000001";
  let mode: "exact" | "hard" = "exact";
  await installApi(page);
  await page.route("**/api/internal/bookings/historical", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await envelope(route, null, {
      status: 409,
      code:
        mode === "exact"
          ? "HISTORICAL_DUPLICATE_BOOKING"
          : "HISTORICAL_OVERLAP_CONFLICT",
      message: "Conflict",
      metadata:
        mode === "exact"
          ? { duplicateOf: duplicateId, matchReason: "exact" }
          : {
              conflicts: [
                {
                  bookingId: duplicateId,
                  status: "Confirmed",
                  checkInDate: "2026-06-10",
                  checkOutDate: "2026-06-13",
                },
              ],
            },
    });
  });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText(`Existing booking: ${duplicateId}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Acknowledge exact IDs" })).toHaveCount(0);
  mode = "hard";
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText(`Booking ${duplicateId}`, { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Acknowledge exact IDs" })).toHaveCount(0);
});

test("unknown booking outcome freezes one semantic command and authoritative conflicts stay definite", async ({
  page,
}) => {
  const state = await installApi(page, { bookingResponseLoss: true });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Booking outcome unknown")).toBeVisible();
  await expect(page.getByText("Booking not created")).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Historical booking draft" })
  ).toHaveAttribute("disabled", "");
  await page
    .getByRole("button", { name: "Retry unchanged booking command" })
    .click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  expect(state.bookingPosts).toHaveLength(2);
  expect(state.bookingPosts[1]).toEqual(state.bookingPosts[0]);
});

test("gateway 504 preserves the exact booking command until idempotent recovery", async ({
  page,
}) => {
  const state = await installApi(page);
  const outgoing: Array<{
    method: string;
    url: string;
    body: Record<string, unknown>;
    key: string;
  }> = [];
  let gatewayResponse = true;
  await page.route("**/api/internal/bookings/historical", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    outgoing.push({
      method: request.method(),
      url: new URL(request.url()).pathname,
      body: request.postDataJSON() as Record<string, unknown>,
      key: request.headers()["idempotency-key"] ?? "",
    });
    if (gatewayResponse) {
      gatewayResponse = false;
      state.committedBooking = true;
      await envelope(route, null, {
        status: 504,
        message: "Gateway timeout after upstream commit",
      });
      return;
    }
    await route.fallback();
  });

  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Booking outcome unknown")).toBeVisible();
  await expect(page.getByText("Booking not created")).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Historical booking draft" })
  ).toHaveAttribute("disabled", "");

  await page
    .getByRole("button", { name: "Retry unchanged booking command" })
    .click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  await expect(page.getByTestId("booking-created-state")).toContainText(
    BOOKING_ID
  );
  expect(outgoing).toHaveLength(2);
  expect(outgoing[1]).toEqual(outgoing[0]);
  expect(outgoing[0]?.method).toBe("POST");
  expect(outgoing[0]?.url).toBe("/api/internal/bookings/historical");
  expect(state.committedBooking).toBe(true);
  expect(state.bookingPosts).toHaveLength(1);
});

test("controlled application 500 is a definite booking failure", async ({
  page,
}) => {
  await installApi(page);
  await page.route("**/api/internal/bookings/historical", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await envelope(route, null, {
      status: 500,
      message: "Controlled application failure",
    });
  });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Booking not created")).toBeVisible();
  await expect(page.getByText("Booking outcome unknown")).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Historical booking draft" })
  ).not.toHaveAttribute("disabled", "");
});

test("sequential duplicate and date-block rounds accumulate exact acknowledgements", async ({
  page,
}) => {
  const duplicateId = "94000000-0000-4000-8000-000000000001";
  const dateBlockId = "95000000-0000-4000-8000-000000000001";
  const outgoing: Record<string, unknown>[] = [];
  await installApi(page);
  await page.route("**/api/internal/bookings/historical", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    outgoing.push(body);
    if (outgoing.length === 1) {
      await envelope(route, null, {
        status: 409,
        code: "HISTORICAL_DUPLICATE_BOOKING",
        message: "Probable duplicate",
        metadata: {
          candidates: [
            {
              bookingId: duplicateId,
              status: "Confirmed",
              checkInDate: "2026-06-10",
              checkOutDate: "2026-06-13",
            },
            {
              bookingId: duplicateId,
              status: "Confirmed",
              checkInDate: "2026-06-10",
              checkOutDate: "2026-06-13",
            },
          ],
        },
      });
      return;
    }
    if (outgoing.length === 2) {
      await envelope(route, null, {
        status: 409,
        code: "HISTORICAL_OVERLAP_CONFLICT",
        message: "Approved date block",
        metadata: {
          dateBlocks: [
            {
              dateBlockId,
              startDate: "2026-06-11",
              endDate: "2026-06-12",
            },
            {
              dateBlockId,
              startDate: "2026-06-11",
              endDate: "2026-06-12",
            },
          ],
        },
      });
      return;
    }
    await route.fallback();
  });

  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  expect(outgoing[0]?.acknowledgedDuplicateOf).toEqual([]);
  expect(outgoing[0]?.acknowledgedDateBlockIds).toEqual([]);

  await page.getByRole("button", { name: "Acknowledge exact IDs" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  expect(outgoing[1]?.acknowledgedDuplicateOf).toEqual([duplicateId]);
  expect(outgoing[1]?.acknowledgedDateBlockIds).toEqual([]);

  await page.getByRole("button", { name: "Acknowledge exact IDs" }).click();
  await expect(page.getByText(duplicateId, { exact: false })).toBeVisible();
  await expect(page.getByText(dateBlockId, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  expect(outgoing[2]?.acknowledgedDuplicateOf).toEqual([duplicateId]);
  expect(outgoing[2]?.acknowledgedDateBlockIds).toEqual([dateBlockId]);
  await expect(page.getByText("Historical booking created")).toBeVisible();
});

test("gateway 504 payment remains reconciliation-required after permission loss and reload", async ({
  page,
}) => {
  const state = await installApi(page);
  const paymentAttempts: Array<{ body: unknown; key: string }> = [];
  await page.route(
    `**/api/internal/bookings/${BOOKING_ID}/historical-payments`,
    async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.fallback();
      paymentAttempts.push({
        body: request.postDataJSON(),
        key: request.headers()["idempotency-key"] ?? "",
      });
      state.committedPayment = true;
      await envelope(route, null, {
        status: 504,
        message: "Gateway timeout after upstream commit",
      });
    }
  );
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  await fillHistoricalPayment(page);
  await page.getByRole("button", { name: "Record payment evidence" }).click();
  await expect(page.getByText("Payment outcome unknown")).toBeVisible();
  const recovery = await page.evaluate(
    () => window.history.state.hb06HistoricalRecovery
  );
  expect(recovery.payment.status).toBe("outcome-unknown");
  expect(recovery.payment.idempotencyKey).toBe(paymentAttempts[0]?.key);

  state.permissions = ["bookings:read", "bookings:record_historical"];
  await page.reload();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  await expect(
    page.getByText("Payment outcome requires reconciliation")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record payment evidence" })
  ).toHaveCount(0);
  expect(paymentAttempts).toHaveLength(1);
  expect(state.bookingPosts).toHaveLength(1);
});

test("tampered recovery is unverified and payment unknown after reload blocks a second command", async ({
  page,
}) => {
  const randomId = "93000000-0000-4000-8000-000000000001";
  const state = await installApi(page);
  await page.addInitScript((bookingId) => {
    if (window.sessionStorage.getItem("hb06-tamper-installed")) return;
    window.sessionStorage.setItem("hb06-tamper-installed", "true");
    window.history.replaceState(
      {
        ...window.history.state,
        hb06HistoricalRecovery: {
          version: 1,
          bookingId,
          payment: {
            idempotencyKey: "20000000-0000-4000-8000-000000000001",
            status: "outcome-unknown",
          },
        },
      },
      "",
      window.location.href
    );
  }, randomId);
  await page.goto("/admin/bookings/historical/new");
  await expect(page.getByText("Booking success is not confirmed")).toBeVisible();
  await expect(
    page.getByText("Payment outcome requires reconciliation")
  ).toBeVisible();
  await expect(page.getByText("Historical booking created")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Optional payment evidence" })).toHaveCount(0);
  expect(state.bookingPosts).toHaveLength(0);
  expect(state.paymentPosts).toHaveLength(0);

  await page.evaluate(() => {
    const next = { ...window.history.state };
    delete next.hb06HistoricalRecovery;
    window.history.replaceState(next, "", window.location.href);
  });
  await page.reload();
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  state.paymentResponseLoss = true;
  await page.getByLabel("Amount (EGP)").fill("1000");
  await page.getByLabel("Payment method").selectOption("cash");
  await page.getByLabel("Paid at").fill("2026-07-15T10:30");
  await page.getByLabel("Recording reason").fill("Verified legacy receipt");
  await page.getByRole("button", { name: "Record payment evidence" }).click();
  await expect(page.getByText("Payment outcome unknown")).toBeVisible();
  const persisted = await page.evaluate(() => window.history.state.hb06HistoricalRecovery);
  expect(JSON.stringify(persisted)).not.toContain("1000");
  expect(JSON.stringify(persisted)).not.toContain("Verified legacy receipt");
  await page.reload();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  await expect(page.getByText("Payment outcome requires reconciliation")).toBeVisible();
  await expect(page.getByRole("button", { name: /payment/i })).toHaveCount(0);
  expect(state.paymentPosts).toHaveLength(1);
  expect(state.bookingPosts).toHaveLength(1);
});

test("permission refresh after commit preserves booking and independently removes optional actions", async ({
  page,
}) => {
  const state = await installApi(page);
  let first = true;
  await page.route(`**/api/internal/bookings/${BOOKING_ID}/owner-attribution-review`, async (route) => {
    if (first) {
      first = false;
      state.permissions = ["units:read", "clients:read"];
      await envelope(route, null, { status: 401, message: "Refresh permissions" });
      return;
    }
    await envelope(route, null, { status: 403, message: "Forbidden" });
  });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  await expect(page.getByTestId("booking-created-state")).toContainText(BOOKING_ID);
  await expect(page.getByText("Historical payment recording is unavailable")).toBeVisible();
  expect(state.bookingPosts).toHaveLength(1);
  expect(state.paymentPosts).toHaveLength(0);
});

test("in-progress booking recovery retries the identical command while idempotency reuse is a definite rejection", async ({
  page,
}) => {
  const state = await installApi(page);
  let response: "in-progress" | "reused" | "success" = "in-progress";
  const firstAttempts: Array<{ body: unknown; key: string }> = [];
  await page.route("**/api/internal/bookings/historical", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    if (response === "success") return route.fallback();
    firstAttempts.push({
      body: route.request().postDataJSON(),
      key: route.request().headers()["idempotency-key"] ?? "",
    });
    await envelope(route, null, {
      status: 409,
      code:
        response === "in-progress"
          ? "IDEMPOTENCY_REQUEST_IN_PROGRESS"
          : "IDEMPOTENCY_KEY_REUSED",
      message: "Idempotency conflict",
    });
  });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Booking outcome unknown")).toBeVisible();
  response = "success";
  await page
    .getByRole("button", { name: "Retry unchanged booking command" })
    .click();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  expect(state.bookingPosts).toHaveLength(1);
  expect(state.bookingPosts[0]).toEqual(firstAttempts[0]);

  await page.evaluate(() => {
    const next = { ...window.history.state };
    delete next.hb06HistoricalRecovery;
    window.history.replaceState(next, "", window.location.href);
  });
  await page.goto("/admin/bookings/historical/new");
  response = "reused";
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Booking not created")).toBeVisible();
  await expect(page.getByText("Booking outcome unknown")).toHaveCount(0);
});

test("payment validation envelopes use safe field messages and malformed success remains contained", async ({
  page,
}) => {
  const state = await installApi(page);
  let paymentResponse: "validation" | "malformed" = "validation";
  await page.route(`**/api/internal/bookings/${BOOKING_ID}/historical-payments`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    if (paymentResponse === "validation") {
      await envelope(route, null, {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        errors: ["Reference number must be 100 characters or fewer."],
      });
      return;
    }
    await envelope(route, {
      bookingId: BOOKING_ID,
      amount: 1000,
      paymentMethod: "cash",
      paidAt: "2026-07-15T07:30:00Z",
      isHistoricalRecord: true,
    });
  });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Historical booking created")).toBeVisible();

  await page.getByRole("button", { name: "Record payment evidence" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Amount" })).toBeVisible();
  await expect(page.getByLabel("Amount (EGP)")).toBeFocused();
  await fillHistoricalPayment(page);
  await page.getByRole("button", { name: "Record payment evidence" }).click();
  await expect(page.getByText("Reference number must be 100 characters or fewer.")).toBeVisible();
  paymentResponse = "malformed";
  await page.getByLabel("Reference (optional)").fill("LEGACY-124");
  await page.getByRole("button", { name: "Record payment evidence" }).click();
  await expect(page.getByText("Payment outcome unknown")).toBeVisible();
  await expect(page.getByText("Historical booking created")).toBeVisible();
  expect(state.bookingPosts).toHaveLength(1);
});

test("malformed owner review and owner/payment concurrency preserve orthogonal states", async ({
  page,
}) => {
  const state = await installApi(page, { ownerMode: "delayed" });
  const paymentGate: { release?: () => void } = {};
  await page.route(`**/api/internal/bookings/${BOOKING_ID}/historical-payments`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await new Promise<void>((resolve) => {
      paymentGate.release = resolve;
    });
    await route.fallback();
  });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByText("Loading persisted attribution")).toBeVisible();
  await fillHistoricalPayment(page, "wallet");
  await page.getByRole("button", { name: "Record payment evidence" }).click();
  const paymentButton = page.getByRole("button", { name: "Record payment evidence" });
  await expect(paymentButton).toBeDisabled();
  await expect.poll(() => state.releaseOwnerReview !== null).toBe(true);
  state.releaseOwnerReview?.();
  await expect(page.getByText(OWNER_ID)).toBeVisible();
  await expect(paymentButton).toBeDisabled();
  await expect.poll(() => Boolean(paymentGate.release)).toBe(true);
  paymentGate.release?.();
  await expect(page.getByText("Payment evidence recorded")).toBeVisible();
  expect(state.paymentPosts).toHaveLength(1);
  expect(state.bookingPosts).toHaveLength(1);
});

test("a mismatched owner-review response is terminal without losing committed booking truth", async ({
  page,
}) => {
  const state = await installApi(page);
  await page.route(
    `**/api/internal/bookings/${BOOKING_ID}/owner-attribution-review`,
    async (route) => {
      await envelope(route, {
        bookingId: "70000000-0000-4000-8000-000000000099",
        currentOwnerId: OWNER_ID,
        canCorrect: true,
        payoutReviewRequired: false,
        warnings: [],
      });
    }
  );
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();

  await expect(page.getByText("Historical booking created")).toBeVisible();
  await expect(page.getByText("Owner attribution referred to a different booking")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry owner review" })).toHaveCount(0);
  expect(state.bookingPosts).toHaveLength(1);
});

test("pending navigation is guarded and cancellation distinguishes pristine from dirty drafts", async ({
  page,
}) => {
  await installApi(page);
  await page.goto("/admin/bookings/historical/new");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/admin\/bookings$/);

  await page.goto("/admin/bookings/historical/new");
  await expect(page.getByRole("heading", { name: "Record historical booking" })).toBeVisible();
  await page.getByLabel("Original source").selectOption("offline_record");
  let dialogs = 0;
  page.once("dialog", async (dialog) => {
    dialogs += 1;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(dialogs).toBe(1);
  await expect(page).toHaveURL(/\/admin\/bookings\/historical\/new$/);

  const bookingGate: { release?: () => void } = {};
  await page.route("**/api/internal/bookings/historical", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await new Promise<void>((resolve) => {
      bookingGate.release = resolve;
    });
    await route.fallback();
  });
  await reachStepSix(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record historical booking" }).click();
  await expect(page.getByRole("button", { name: "Bookings" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeDisabled();
  const browserNavigationPrevented = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(browserNavigationPrevented).toBe(true);
  await expect(page).toHaveURL(/\/admin\/bookings\/historical\/new$/);
  await expect.poll(() => Boolean(bookingGate.release)).toBe(true);
  bookingGate.release?.();
  await expect(page.getByText("Historical booking created")).toBeVisible();
});
