import { test, expect } from "../fixtures/auth.fixture";
import {
  expectNoPiiInPayload,
  expectNoPiiInText,
} from "../helpers/assertions";

test.describe("Owner Portal Bookings & PII Privacy Guard", () => {
  test("Can view bookings list, verify read-only states, and enforce strict PII privacy masking", async ({ ownerPageA }) => {
    const interceptedPayloads: unknown[] = [];
    ownerPageA.on("response", async (response) => {
      if (response.url().includes("/api/owner/bookings")) {
        try {
          const body = await response.json();
          interceptedPayloads.push(body);
        } catch (e) {
          // ignore non-json
        }
      }
    });

    await ownerPageA.goto("/owner/bookings");
    await expect(ownerPageA.locator("main h1")).toContainText(/Bookings/i);

    const bookingRows = ownerPageA.locator("table tbody tr");
    await expect(bookingRows.first()).toBeVisible({ timeout: 10000 });

    const actionBtn = ownerPageA.locator('button:has-text("Approve"), button:has-text("Reject"), button:has-text("Confirm Booking")');
    await expect(actionBtn).not.toBeVisible();

    expect(interceptedPayloads.length).toBeGreaterThan(0);
    interceptedPayloads.forEach((payload, index) => {
      expectNoPiiInPayload(payload, `owner booking response ${index + 1}`);
    });

    const bodyText = await ownerPageA.innerText("body");
    expectNoPiiInText(bodyText, "owner bookings list DOM");

    await bookingRows.first().click();
    await ownerPageA.waitForURL(/\/owner\/bookings\/[a-f0-9-]/, { timeout: 10000 });

    await expect(ownerPageA.locator("main h1")).toBeVisible();
    
    const detailBodyText = await ownerPageA.innerText("body");
    expectNoPiiInText(detailBodyText, "owner booking detail DOM");

    const detailActionBtn = ownerPageA.locator('button:has-text("Approve"), button:has-text("Reject"), button:has-text("Check In"), button:has-text("Complete")');
    await expect(detailActionBtn).not.toBeVisible();
  });
});
