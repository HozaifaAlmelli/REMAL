import { expect, test, type Page, type Route } from "@playwright/test";

const ADMIN_ID = "10000000-0000-4000-8000-000000000001";
const OWNER_ID = "20000000-0000-4000-8000-000000000001";
const UNIT_ID = "30000000-0000-4000-8000-000000000001";
const CLIENT_ID = "40000000-0000-4000-8000-000000000001";
const ORDINARY_BOOKING_ID = "50000000-0000-4000-8000-000000000001";
const HISTORICAL_BOOKING_ID = "60000000-0000-4000-8000-000000000001";
const PAYMENT_ID = "70000000-0000-4000-8000-000000000001";

const cors = {
  "access-control-allow-origin": "http://localhost:3105",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, OPTIONS",
};

interface FixtureState {
  calls: string[];
  posts: string[];
}

async function envelope(
  route: Route,
  data: unknown,
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }
) {
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
      pagination: pagination ?? null,
    }),
  });
}

function booking(isHistorical: boolean) {
  return {
    id: isHistorical ? HISTORICAL_BOOKING_ID : ORDINARY_BOOKING_ID,
    clientId: CLIENT_ID,
    clientName: isHistorical ? "Historical Client" : "Ordinary Client",
    clientPhone: "+2010******001",
    unitId: UNIT_ID,
    unitName: "LOCAL TEST Unit",
    ownerId: OWNER_ID,
    assignedAdminUserId: ADMIN_ID,
    assignedAdminUserName: "Test Operator",
    assignedAdminUserRole: "Operations",
    bookingStatus: isHistorical ? "Completed" : "Confirmed",
    checkInDate: isHistorical ? "2026-01-10" : "2026-08-20",
    checkOutDate: isHistorical ? "2026-01-13" : "2026-08-23",
    guestCount: 2,
    baseAmount: isHistorical ? 6000 : 5000,
    finalAmount: isHistorical ? 6000 : 5000,
    source: "admin",
    internalNotes: null,
    createdAt: "2026-08-11T08:30:00Z",
    updatedAt: "2026-08-11T08:30:00Z",
    isHistorical,
    actualBookedAt: isHistorical ? "2025-12-15" : null,
    originalSource: isHistorical ? "external_platform" : null,
    historicalEntryReason: isHistorical ? "external_platform_import" : null,
    agreedAmount: isHistorical ? 6000 : null,
    isAgedSoftHold: false,
    softHoldAgeDays: null,
  };
}

async function installFixture(
  page: Page,
  options: {
    permissions?: string[];
    subjectType?: "Admin" | "Owner";
  } = {}
): Promise<FixtureState> {
  const permissions = options.permissions ?? [
    "analytics:read",
    "bookings:read",
    "bookings:record_historical",
    "clients:read",
    "finance:overview",
    "units:read",
  ];
  const subjectType = options.subjectType ?? "Admin";
  const state: FixtureState = { calls: [], posts: [] };

  if (subjectType === "Owner") {
    await page.addInitScript(
      ({ ownerId }) => {
        localStorage.setItem(
          "kaza-auth",
          JSON.stringify({
            state: {
              subjectType: "Owner",
              user: {
                userId: ownerId,
                identifier: "operator@example.test",
                subjectType: "Owner",
                adminRole: null,
                name: "LOCAL TEST Operator",
              },
              role: "Owner",
              roleName: "Owner",
              permissions: [],
            },
            version: 0,
          })
        );
      },
      { ownerId: OWNER_ID }
    );
  }

  await page.route("http://historical-reporting-fixture.local/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.calls.push(`${request.method()} ${url.pathname}${url.search}`);
    if (request.method() === "POST" && url.pathname !== "/api/auth/refresh") {
      state.posts.push(url.pathname);
    }

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }

    if (url.pathname === "/api/auth/refresh") {
      await envelope(route, {
        accessToken: "sanitized-access-token",
        expiresInSeconds: 3600,
        subjectType,
        adminRole: subjectType === "Admin" ? "SuperAdmin" : null,
        roleName: subjectType === "Admin" ? "Super Admin" : "Owner",
        user: {
          userId: subjectType === "Admin" ? ADMIN_ID : OWNER_ID,
          identifier: "operator@example.test",
          subjectType,
          adminRole: subjectType === "Admin" ? "SuperAdmin" : null,
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

    if (url.pathname === "/api/internal/bookings") {
      const historicalFilter = url.searchParams.get("isHistorical");
      const requestedPage = Number(url.searchParams.get("page") ?? 1);
      const noMatches = url.searchParams.get("search") === "no matches";
      const rows =
        noMatches
          ? []
          : historicalFilter === "true"
          ? [booking(true)]
          : historicalFilter === "false"
            ? [booking(false)]
            : requestedPage === 2
              ? [booking(false)]
              : [booking(false), booking(true)];
      const isAllScope = historicalFilter === null && !noMatches;
      await envelope(route, rows, {
        page: requestedPage,
        pageSize: 20,
        totalCount: isAllScope ? 21 : rows.length,
        totalPages: isAllScope ? 2 : 1,
      });
      return;
    }

    if (url.pathname === `/api/internal/bookings/${HISTORICAL_BOOKING_ID}`) {
      await envelope(route, booking(true));
      return;
    }

    if (
      url.pathname ===
      `/api/internal/bookings/${HISTORICAL_BOOKING_ID}/finance-snapshot`
    ) {
      await envelope(route, {
        bookingId: HISTORICAL_BOOKING_ID,
        remainingAmount: 6000,
        invoicedAmount: 6000,
        paidAmount: 0,
        invoiceId: null,
        invoiceStatus: null,
        ownerPayoutStatus: null,
      });
      return;
    }

    if (
      url.pathname ===
      `/api/internal/bookings/${HISTORICAL_BOOKING_ID}/status-history`
    ) {
      await envelope(route, [
        {
          id: "80000000-0000-4000-8000-000000000001",
          bookingId: HISTORICAL_BOOKING_ID,
          oldStatus: null,
          newStatus: "Completed",
          changedByAdminUserId: ADMIN_ID,
          actorDisplayName: "Test Operator",
          actorType: "admin",
          notes: "historical booking recorded",
          changedAt: "2026-08-11T08:30:00Z",
        },
      ]);
      return;
    }

    if (url.pathname === "/api/internal/payments") {
      await envelope(
        route,
        [
          {
            id: PAYMENT_ID,
            bookingId: HISTORICAL_BOOKING_ID,
            invoiceId: null,
            clientName: null,
            clientPhone: null,
            paymentStatus: "paid",
            paymentMethod: "bank_transfer",
            amount: 3000,
            referenceNumber: null,
            notes: null,
            paidAt: "2026-02-15T10:00:00Z",
            isHistoricalRecord: true,
            createdAt: "2026-08-11T08:35:00Z",
            updatedAt: "2026-08-11T08:35:00Z",
          },
        ],
        { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 }
      );
      return;
    }

    if (url.pathname === `/api/internal/units/${UNIT_ID}`) {
      await envelope(route, {
        id: UNIT_ID,
        ownerId: OWNER_ID,
        projectId: "90000000-0000-4000-8000-000000000001",
        projectName: "LOCAL TEST Project",
        name: "LOCAL TEST Unit",
        unitType: "apartment",
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        basePricePerNight: 2000,
        isActive: true,
        isVisibleInPortfolio: true,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      });
      return;
    }

    if (url.pathname === `/api/clients/${CLIENT_ID}`) {
      await envelope(route, {
        id: CLIENT_ID,
        name: "Historical Client",
        phone: "+201000000001",
        email: "historical@example.test",
        isActive: true,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      });
      return;
    }

    if (url.pathname.endsWith("/notes")) {
      await envelope(route, []);
      return;
    }

    if (url.pathname.endsWith("/assignment")) {
      await envelope(route, null);
      return;
    }

    if (url.pathname === "/api/internal/reports/bookings/summary") {
      await envelope(route, {
        dateFrom: "2026-05-11",
        dateTo: "2026-08-11",
        bookingSource: null,
        totalBookingsCreatedCount: 12,
        totalProspectingBookingsCount: 4,
        totalConfirmedBookingsCount: 3,
        totalCancelledBookingsCount: 2,
        totalCompletedBookingsCount: 5,
        totalFinalAmount: 30000,
        historicalBookingsCount: 2,
        historicalAgreedAmount: 11000,
        historicalLegacySystemBookingsCount: 0,
        historicalExternalPlatformBookingsCount: 1,
        historicalOfflineRecordBookingsCount: 1,
        historicalOtherSourceBookingsCount: 0,
      });
      return;
    }

    if (url.pathname === "/api/internal/reports/finance/summary" || url.pathname === "/api/internal/finance/overview") {
      await envelope(route, {
        dateFrom: "2026-05-11",
        dateTo: "2026-08-11",
        totalBookingsWithInvoiceCount: 4,
        totalInvoicedAmount: 18000,
        totalPaidAmount: 8000,
        totalRemainingAmount: 10000,
        historicalPaymentEvidenceCount: 1,
        historicalPaymentEvidenceAmount: 3000,
        totalPendingPayoutAmount: 1000,
        totalScheduledPayoutAmount: 0,
        totalPaidPayoutAmount: 2000,
        historicalBookingsCount: 2,
        historicalAgreedAmount: 11000,
        historicalBookingsWithInvoiceCount: 1,
        historicalInvoicedAmount: 6000,
        ordinaryUnlinkedPaidCount: 1,
        ordinaryUnlinkedPaidAmount: 500,
      });
      return;
    }

    if (url.pathname === "/api/internal/reports/bookings/daily") {
      await envelope(
        route,
        [
          {
            metricDate: "2026-08-11",
            bookingSource: "admin",
            bookingsCreatedCount: 3,
            prospectingBookingsCount: 1,
            confirmedBookingsCount: 1,
            cancelledBookingsCount: 0,
            completedBookingsCount: 2,
            totalFinalAmount: 15000,
            historicalBookingsCount: 2,
            historicalAgreedAmount: 11000,
            historicalLegacySystemBookingsCount: 0,
            historicalExternalPlatformBookingsCount: 1,
            historicalOfflineRecordBookingsCount: 1,
            historicalOtherSourceBookingsCount: 0,
          },
        ],
        { page: 1, pageSize: 30, totalCount: 1, totalPages: 1 }
      );
      return;
    }

    if (url.pathname === "/api/internal/reports/finance/daily") {
      await envelope(
        route,
        [
          {
            metricDate: "2026-08-11",
            bookingsWithInvoiceCount: 2,
            totalInvoicedAmount: 12000,
            totalPaidAmount: 4000,
            totalRemainingAmount: 8000,
            totalPendingPayoutAmount: 1000,
            totalScheduledPayoutAmount: 0,
            totalPaidPayoutAmount: 0,
            historicalBookingsCount: 2,
            historicalAgreedAmount: 11000,
            historicalBookingsWithInvoiceCount: 1,
            historicalInvoicedAmount: 6000,
            ordinaryUnlinkedPaidCount: 1,
            ordinaryUnlinkedPaidAmount: 500,
            historicalEvidenceRecordedCount: 1,
            historicalEvidenceRecordedAmount: 3000,
          },
        ],
        { page: 1, pageSize: 30, totalCount: 1, totalPages: 1 }
      );
      return;
    }

    if (url.pathname === "/api/internal/reports/bookings/stay-daily") {
      await envelope(
        route,
        [
          {
            stayStartDate: "2026-01-10",
            bookingSource: "admin",
            stayBookingsCount: 2,
            prospectingBookingsCount: 0,
            confirmedBookingsCount: 1,
            cancelledBookingsCount: 0,
            completedBookingsCount: 1,
            totalFinalAmount: 11000,
            historicalBookingsCount: 1,
            historicalAgreedAmount: 6000,
            historicalLegacySystemBookingsCount: 0,
            historicalExternalPlatformBookingsCount: 1,
            historicalOfflineRecordBookingsCount: 0,
            historicalOtherSourceBookingsCount: 0,
          },
        ],
        { page: 1, pageSize: 30, totalCount: 1, totalPages: 1 }
      );
      return;
    }

    if (url.pathname === "/api/internal/reports/finance/stay-daily") {
      await envelope(
        route,
        [
          {
            stayStartDate: "2026-01-10",
            stayBookingsCount: 2,
            bookingsWithInvoiceCount: 1,
            totalInvoicedAmount: 6000,
            totalFinalAmount: 11000,
            historicalBookingsCount: 1,
            historicalAgreedAmount: 6000,
            historicalBookingsWithInvoiceCount: 1,
            historicalInvoicedAmount: 6000,
          },
        ],
        { page: 1, pageSize: 30, totalCount: 1, totalPages: 1 }
      );
      return;
    }

    if (url.pathname === "/api/internal/reports/bookings/historical-reconciliation") {
      await envelope(
        route,
        [
          {
            bookingId: HISTORICAL_BOOKING_ID,
            recordedDate: "2026-08-11",
            recordedAt: "2026-08-11T08:30:00Z",
            actualBookedAt: "2025-12-15",
            entryLagDays: 239,
            stayStartDate: "2026-01-10",
            stayEndDate: "2026-01-13",
            stayNights: 3,
            bookingSource: "admin",
            originalSource: "external_platform",
            historicalEntryReason: "external_platform_import",
            bookingStatus: "completed",
            unitId: UNIT_ID,
            ownerId: OWNER_ID,
            agreedAmount: 6000,
            invoicedAmount: 6000,
            invoiceLinkedPaidAmount: 0,
            ordinaryUnlinkedPaidCount: 0,
            ordinaryUnlinkedPaidAmount: 0,
            historicalPaymentEvidenceCount: 1,
            historicalPaymentEvidenceAmount: 3000,
            firstEvidencePaidDate: "2026-02-15",
            lastEvidencePaidDate: "2026-02-15",
            ownerAttributionCorrectionCount: 1,
            lastOwnerAttributionCorrectedAt: "2026-08-11T09:00:00Z",
          },
        ],
        { page: 1, pageSize: 30, totalCount: 1, totalPages: 1 }
      );
      return;
    }

    if (url.pathname === "/api/owner/bookings") {
      await envelope(
        route,
        [
          {
            bookingId: HISTORICAL_BOOKING_ID,
            unitId: UNIT_ID,
            clientId: CLIENT_ID,
            assignedAdminUserId: ADMIN_ID,
            checkInDate: "2026-01-10",
            checkOutDate: "2026-01-13",
            guestCount: 2,
            bookingStatus: "Completed",
            finalAmount: 6000,
            source: "admin",
            isHistorical: true,
            createdAt: "2026-08-11T08:30:00Z",
            updatedAt: "2026-08-11T08:30:00Z",
          },
        ],
        { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 }
      );
      return;
    }

    if (url.pathname === "/api/owner/units") {
      await envelope(
        route,
        [
          {
            unitId: UNIT_ID,
            projectId: "90000000-0000-4000-8000-000000000001",
            unitName: "LOCAL TEST Unit",
            unitType: "apartment",
            isActive: true,
            bedrooms: 2,
            bathrooms: 1,
            maxGuests: 4,
            basePricePerNight: 2000,
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        ],
        { page: 1, pageSize: 100, totalCount: 1, totalPages: 1 }
      );
      return;
    }

    await envelope(route, null);
  });

  return state;
}

test("booking list filters and detail use canonical Historical truth", async ({ page }) => {
  const state = await installFixture(page);
  await page.goto("/admin/bookings");

  await expect(
    page.getByRole("main").getByRole("heading", { name: "Bookings" })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Historical Booking")).toHaveCount(1);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Historical", exact: true }).click();
  await expect(page).toHaveURL(/bookingType=historical/);
  await expect(page).not.toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Ordinary", exact: true }).click();
  await expect(page).toHaveURL(/bookingType=ordinary/);
  await expect(page.getByLabel("Historical Booking")).toHaveCount(0);
  await page.getByRole("button", { name: "Historical", exact: true }).click();
  await expect(page).toHaveURL(/bookingType=historical/);
  await expect(page.getByLabel("Historical Booking")).toHaveCount(1);

  const search = page.getByPlaceholder("Search name, unit, or reference…");
  await search.fill("no matches");
  await expect(page.getByText(/No bookings match these filters/)).toBeVisible();
  await search.fill("");
  await expect(page.getByLabel("Historical Booking")).toHaveCount(1);

  await Promise.all([
    page.waitForURL(new RegExp(`/admin/bookings/${HISTORICAL_BOOKING_ID}$`), {
      timeout: 15_000,
    }),
    page.getByRole("button", { name: "View Details" }).click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Historical Booking context" })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Actual booked date")).toBeVisible();
  await expect(page.getByText("External platform", { exact: true })).toBeVisible();
  await expect(page.getByText("historical booking recorded")).toBeVisible();
  await expect(
    page.getByText("Historical Payment Evidence", { exact: true })
  ).toBeVisible();
  await expect(page.getByText(/does not settle an invoice/)).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Historical Booking context" })
      .getByText("6,000.00 EGP", { exact: true })
  ).toBeVisible();
  expect(state.posts).toEqual([]);
});

test("recorded, stay, funnel, finance and reconciliation semantics remain distinct", async ({ page }) => {
  const state = await installFixture(page);
  await page.goto("/admin/analytics");

  await expect(
    page.getByRole("heading", {
      name: "Bookings entered in KAZA by recorded date",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Historical Payment Evidence" })
  ).toBeVisible();
  await expect(page.getByText(/Historical records entered: 2; not included/)).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Platform paid" })
  ).toBeVisible();

  await page.getByRole("tab", { name: "Stay" }).click();
  await expect(page.getByRole("heading", { name: "Bookings by stay start date" })).toBeVisible();
  await expect(page.getByText("10 Jan 2026", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/does not attribute cash or Historical Payment Evidence/)).toBeVisible();

  await page.getByRole("button", { name: "Ordinary", exact: true }).click();
  await expect.poll(() => state.calls.some((call) =>
    call.includes("/reports/bookings/stay-daily") &&
    call.includes("includeHistorical=false")
  )).toBe(true);

  await page.getByRole("tab", { name: "Reconciliation" }).click();
  await expect(page.getByRole("heading", { name: "Historical reconciliation by booking" })).toBeVisible();
  await expect(page.getByText("BKG-000001", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "3,000.00 EGP (1)" })
  ).toBeVisible();
  expect(state.posts).toEqual([]);
});

test("Historical write access alone never grants reporting", async ({ page }) => {
  const state = await installFixture(page, {
    permissions: ["bookings:read", "bookings:record_historical"],
  });
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "Analytics access required" })).toBeVisible();
  expect(state.calls.some((call) => call.includes("/api/internal/reports/"))).toBe(false);
});

test("owner portal labels Historical stays without exposing reconciliation data", async ({ page }) => {
  const state = await installFixture(page, { subjectType: "Owner", permissions: [] });
  await page.goto("/owner/bookings");
  await expect(page.getByLabel("Historical Booking")).toBeVisible();
  await expect(page.getByText("Recorded by KAZA admin")).toBeVisible();
  await expect(page.getByText("Historical Payment Evidence")).toHaveCount(0);
  expect(state.posts).toEqual([]);
});
