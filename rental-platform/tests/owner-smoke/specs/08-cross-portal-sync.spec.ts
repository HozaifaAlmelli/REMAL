import { test, expect } from "../fixtures/auth.fixture";
import {
  cancelBooking,
  cancelOwnerPayout,
  checkOwnerAvailability,
  confirmBooking,
  convertLeadToBooking,
  createOwnerPayout,
  createTestArea,
  createTestLead,
  createTestUnit,
  deactivateTestArea,
  deleteTestUnit,
  getAdminApiToken,
  getOwnerApiToken,
  getOwnerDashboardSummary,
  getOwnerFinanceRowByBooking,
  getOwnerFinanceSummary,
  markBookingBooked,
  qualifyLead,
} from "../helpers/api.helpers";
import { cleanupOwnerSmokeData } from "../helpers/cleanup.helpers";
import {
  formatExpectedCurrency,
  pollUntil,
} from "../helpers/assertions";
import { MOCK_CLIENT, OWNER_USERS, TEST_PREFIX } from "../fixtures/test-data";

interface CreatedUnit {
  id: string;
}

interface CreatedLead {
  id: string;
}

interface CreatedBooking {
  id: string;
  finalAmount: number;
  bookingStatus: string;
}

interface CreatedPayout {
  id: string;
  payoutAmount: number;
}

interface OwnerFinanceRow {
  bookingId: string;
  invoicedAmount: number;
  payoutAmount: number | null;
  payoutStatus: string | null;
}

interface AvailabilityResponse {
  isAvailable: boolean;
  reason: string | null;
  blockedDates: string[];
}

test.describe("Multi-Portal Cross-Role Synchronization Loop", () => {
  let adminToken = "";
  let ownerToken = "";
  let areaId = "";
  let unitId = "";
  let leadId = "";
  let bookingId = "";
  let payoutId = "";

  const checkInDate = "2027-10-10";
  const checkOutDate = "2027-10-12";
  const grossBookingAmount = 2000;
  const commissionRate = 10;
  const expectedOwnerPayout = 1800;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminApiToken(request);
    ownerToken = await getOwnerApiToken(request, "OwnerA");

    const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const area = await createTestArea(request, adminToken, {
      name: `${TEST_PREFIX}Area_${unique}`,
      description: "Owner smoke sync test area",
      isActive: true,
    });
    areaId = area.id;

    const unit = await createTestUnit<CreatedUnit>(request, adminToken, {
      ownerId: OWNER_USERS.OwnerA.id,
      areaId,
      name: `${TEST_PREFIX}Unit_${unique}`,
      description: "Owner smoke sync test unit",
      address: "North Coast",
      unitType: "villa",
      bedrooms: 3,
      bathrooms: 2,
      maxGuests: 6,
      basePricePerNight: 1000,
      isActive: true,
    });
    unitId = unit.id;

    const lead = await createTestLead<CreatedLead>(request, adminToken, {
      clientId: MOCK_CLIENT.id,
      targetUnitId: unitId,
      contactName: `${TEST_PREFIX}Guest_${unique}`,
      contactPhone: MOCK_CLIENT.phone,
      contactEmail: "owner.smoke.guest@example.test",
      source: "website",
      desiredCheckInDate: checkInDate,
      desiredCheckOutDate: checkOutDate,
      guestCount: 2,
      notes: "Owner smoke cross-portal sync lead",
    });
    leadId = lead.id;

    await qualifyLead(request, adminToken, leadId);
    const booking = await convertLeadToBooking<CreatedBooking>(
      request,
      adminToken,
      leadId,
      {
        clientId: MOCK_CLIENT.id,
        unitId,
        checkInDate,
        checkOutDate,
        guestCount: 2,
        internalNotes: "Owner smoke converted booking",
      }
    );
    bookingId = booking.id;
    expect(booking.finalAmount).toBe(grossBookingAmount);
  });

  test.afterAll(async ({ request }) => {
    if (payoutId) await cancelOwnerPayout(request, adminToken, payoutId);
    if (bookingId) await cancelBooking(request, adminToken, bookingId);
    if (unitId) await deleteTestUnit(request, adminToken, unitId);
    if (areaId) await deactivateTestArea(request, adminToken, areaId);
    if (adminToken) await cleanupOwnerSmokeData(request, adminToken);
  });

  test("Propagates confirmed bookings, finance snapshots, payout balances, and blocked availability", async ({
    ownerPageA,
    request,
  }) => {
    test.setTimeout(60_000);

    const preFinance = await getOwnerFinanceSummary(request, ownerToken);
    const preDashboard = await getOwnerDashboardSummary(request, ownerToken);

    await markBookingBooked(request, adminToken, bookingId);
    await confirmBooking(request, adminToken, bookingId);

    const payout = await createOwnerPayout<CreatedPayout>(
      request,
      adminToken,
      {
        bookingId,
        commissionRate,
        notes: "Owner smoke payout snapshot",
      }
    );
    payoutId = payout.id;
    expect(payout.payoutAmount).toBe(expectedOwnerPayout);

    const postFinance = await pollUntil(
      () => getOwnerFinanceSummary(request, ownerToken),
      (summary) =>
        summary.totalInvoicedAmount >=
          preFinance.totalInvoicedAmount + grossBookingAmount &&
        summary.totalPendingPayoutAmount >=
          preFinance.totalPendingPayoutAmount + expectedOwnerPayout,
      { description: "owner finance totals to include confirmed smoke booking" }
    );

    expect(postFinance.totalInvoicedAmount).toBeCloseTo(
      preFinance.totalInvoicedAmount + grossBookingAmount,
      1
    );
    expect(postFinance.totalPendingPayoutAmount).toBeCloseTo(
      preFinance.totalPendingPayoutAmount + expectedOwnerPayout,
      1
    );

    const postDashboard = await pollUntil(
      () => getOwnerDashboardSummary(request, ownerToken),
      (summary) =>
        summary.confirmedBookings >= preDashboard.confirmedBookings + 1 &&
        summary.totalPendingPayoutAmount >=
          preDashboard.totalPendingPayoutAmount + expectedOwnerPayout,
      { description: "owner dashboard totals to include confirmed smoke booking" }
    );

    expect(postDashboard.confirmedBookings).toBeGreaterThanOrEqual(
      preDashboard.confirmedBookings + 1
    );

    const financeRow = await getOwnerFinanceRowByBooking<OwnerFinanceRow>(
      request,
      ownerToken,
      bookingId
    );
    expect(financeRow.bookingId).toBe(bookingId);
    expect(financeRow.invoicedAmount).toBe(grossBookingAmount);
    expect(financeRow.payoutAmount).toBe(expectedOwnerPayout);
    expect(financeRow.payoutStatus?.toLowerCase()).toBe("pending");

    const availability = await checkOwnerAvailability<AvailabilityResponse>(
      request,
      ownerToken,
      unitId,
      checkInDate,
      checkOutDate
    );
    expect(availability.isAvailable).toBe(false);
    expect(availability.reason).toBe("date_booked");
    expect(availability.blockedDates).toEqual(
      expect.arrayContaining(["2027-10-10", "2027-10-11"])
    );

    await ownerPageA.goto("/owner/finance");
    await expect(ownerPageA.locator("main h1")).toContainText(/Finance/i);
    const pendingPayoutCard = ownerPageA
      .locator('div:has(> p:has-text("Total Pending Payout Amount"))')
      .last();
    await expect(
      pendingPayoutCard
    ).toContainText(
      formatExpectedCurrency(postFinance.totalPendingPayoutAmount)
    );

    await ownerPageA.goto(`/owner/units/${unitId}/availability`);
    await expect(ownerPageA.locator("h2")).toContainText(/Availability/i);

    const nextBtn = ownerPageA.locator("button:has(svg.lucide-chevron-right)");
    const monthHeader = ownerPageA
      .locator('span[class*="text-center"]')
      .first();

    let monthText = await monthHeader.innerText();
    let limit = 0;
    while (!monthText.includes("October 2027") && limit < 24) {
      await nextBtn.click();
      await ownerPageA.waitForTimeout(200);
      monthText = await monthHeader.innerText();
      limit++;
    }

    expect(monthText).toContain("October 2027");
    await expect(ownerPageA.locator(".rdp-disabled")).toHaveCount(2, {
      timeout: 10000,
    });
  });
});
