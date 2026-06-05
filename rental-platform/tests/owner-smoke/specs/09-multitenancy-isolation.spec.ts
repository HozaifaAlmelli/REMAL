import { test, expect } from "@playwright/test";
import {
  getOwnerApiToken,
  unwrapPaginatedResponse,
} from "../helpers/api.helpers";
import { apiUrl } from "../helpers/smoke-env";

test.describe("Owner Portal Multitenancy Data Isolation Boundaries", () => {
  let tokenOwnerA: string;
  let tokenOwnerB: string;

  test.beforeAll(async ({ request }) => {
    // Retrieve tokens programmatically
    tokenOwnerA = await getOwnerApiToken(request, "OwnerA");
    tokenOwnerB = await getOwnerApiToken(request, "OwnerB");
  });

  test("Owner A cannot access Owner B's unit details via API", async ({ request }) => {
    // Owner B's unit ID from SQL seeds is: 00000000-0000-0000-0000-000000000005
    const ownerBUnitId = "00000000-0000-0000-0000-000000000005";

    // Attempt request using Owner A's token
    const response = await request.get(apiUrl(`/api/owner/units/${ownerBUnitId}`), {
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
      },
    });

    // The API must reject the request with either 403 Forbidden or 404 Not Found
    expect([403, 404]).toContain(response.status());
  });

  test("Owner A cannot access Owner B's bookings details via API", async ({ request }) => {
    // First query Owner B's bookings to get a valid booking ID
    const ownerBBookingsResponse = await request.get(apiUrl("/api/owner/bookings"), {
      headers: {
        Authorization: `Bearer ${tokenOwnerB}`,
      },
    });

    expect(ownerBBookingsResponse.ok()).toBeTruthy();
    const bookingsB = await unwrapPaginatedResponse<{ bookingId: string }>(
      ownerBBookingsResponse,
      "Get Owner B bookings"
    );

    if (bookingsB.items.length > 0) {
      const ownerBBookingId = bookingsB.items[0]!.bookingId;

      const response = await request.get(apiUrl(`/api/owner/bookings/${ownerBBookingId}`), {
        headers: {
          Authorization: `Bearer ${tokenOwnerA}`,
        },
      });

      expect([403, 404]).toContain(response.status());
    } else {
      console.log("No bookings found for Owner B, skipping booking isolation check");
    }
  });
});
