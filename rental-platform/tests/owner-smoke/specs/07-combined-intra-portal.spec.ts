import { test, expect } from "../fixtures/auth.fixture";
import {
  getOwnerApiToken,
  getOwnerFinanceRowByBooking,
  unwrapPaginatedResponse,
} from "../helpers/api.helpers";
import { apiUrl } from "../helpers/smoke-env";

interface OwnerBookingRow {
  bookingId: string;
  bookingStatus: string;
  finalAmount: number;
}

interface OwnerFinanceRow {
  bookingId: string;
  invoicedAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

test.describe("Owner Portal Combined Intra-Portal Workflows", () => {
  test("Can trace a booking from roster to finance and back with API-aligned values", async ({
    ownerPageA,
    request,
  }) => {
    const ownerToken = await getOwnerApiToken(request, "OwnerA");

    await ownerPageA.goto("/owner/bookings");
    await expect(ownerPageA.locator("main h1")).toContainText(/Bookings/i);

    const bookingsResponse = await request.get(apiUrl("/api/owner/bookings"), {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const bookings = await unwrapPaginatedResponse<OwnerBookingRow>(
      bookingsResponse,
      "Get owner bookings for trace test"
    );
    const traceBooking = bookings.items.find((booking) =>
      ["confirmed", "completed"].includes(booking.bookingStatus.toLowerCase())
    );

    test.skip(
      !traceBooking,
      "No confirmed or completed seeded owner booking exists to trace."
    );

    const bookingId = traceBooking!.bookingId;
    const financeRow = await getOwnerFinanceRowByBooking<OwnerFinanceRow>(
      request,
      ownerToken,
      bookingId
    );

    expect(financeRow.bookingId).toBe(bookingId);
    expect(financeRow.invoicedAmount).toBeGreaterThanOrEqual(
      traceBooking!.finalAmount
    );
    expect(financeRow.remainingAmount).toBeGreaterThanOrEqual(0);

    await ownerPageA.goto("/owner/finance");
    await expect(ownerPageA.locator("main h1")).toContainText(/Finance/i);

    const bookingShortId = bookingId.slice(0, 8);
    const matchedFinanceRow = ownerPageA.locator(
      `table tbody tr:has-text("${bookingShortId}")`
    );
    await expect(matchedFinanceRow).toBeVisible({ timeout: 10000 });

    await expect(matchedFinanceRow).toContainText(bookingShortId);
    await matchedFinanceRow.locator(`a[href*="/owner/bookings/"]`).first().click();

    await ownerPageA.waitForURL(/\/owner\/bookings\/[a-f0-9-]/, {
      timeout: 10000,
    });
    await expect(ownerPageA.locator("main h1")).toContainText(
      /Booking Details/i
    );
    await expect(ownerPageA.locator("body")).toContainText(bookingId);
  });
});

