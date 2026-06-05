import { test, expect } from "../fixtures/auth.fixture";
import {
  formatExpectedCurrency,
  parseCurrencyAmount,
} from "../helpers/assertions";
import type { ApiEnvelope, OwnerDashboardSummary } from "../helpers/api.helpers";

test.describe("Owner Portal Dashboard Metrics", () => {
  test("Loads dashboard metrics and aggregates cleanly from backend", async ({ ownerPageA }) => {
    const dashboardResponsePromise = ownerPageA.waitForResponse(
      (response) =>
        response.url().includes("/api/owner/dashboard") && response.ok()
    );

    await ownerPageA.goto("/owner/dashboard");
    const dashboardResponse = await dashboardResponsePromise;
    const dashboardEnvelope =
      (await dashboardResponse.json()) as ApiEnvelope<OwnerDashboardSummary>;
    const dashboard = dashboardEnvelope.data;
    expect(dashboardEnvelope.success).toBe(true);
    expect(dashboard).not.toBeNull();
    
    await expect(ownerPageA.locator("main h1")).toContainText(/Dashboard/i);
    
    const getCardByLabel = (label: string) => ownerPageA.locator(`div:has(> p:text-is("${label}"))`);
    
    const unitsCard = getCardByLabel("Units");
    const confirmedCard = getCardByLabel("Confirmed Bookings");
    const completedCard = getCardByLabel("Completed Bookings");
    const paidCard = getCardByLabel("Total Paid");
    const pendingCard = getCardByLabel("Pending Payout");

    await expect(unitsCard).toBeVisible({ timeout: 5000 });
    await expect(confirmedCard).toBeVisible();
    await expect(completedCard).toBeVisible();
    await expect(paidCard).toBeVisible();
    await expect(pendingCard).toBeVisible();

    await expect(unitsCard.locator("p.text-2xl")).toContainText(
      `${dashboard!.activeUnits}/${dashboard!.totalUnits}`
    );
    await expect(confirmedCard.locator("p.text-2xl")).toContainText(
      String(dashboard!.confirmedBookings)
    );
    await expect(completedCard.locator("p.text-2xl")).toContainText(
      String(dashboard!.completedBookings)
    );
    await expect(paidCard.locator("p.text-2xl")).toContainText(
      formatExpectedCurrency(dashboard!.totalPaidAmount)
    );
    await expect(pendingCard.locator("p.text-2xl")).toContainText(
      formatExpectedCurrency(dashboard!.totalPendingPayoutAmount)
    );

    expect(parseCurrencyAmount(await paidCard.innerText())).toBe(
      dashboard!.totalPaidAmount
    );
    expect(parseCurrencyAmount(await pendingCard.innerText())).toBe(
      dashboard!.totalPendingPayoutAmount
    );
    expect(dashboard!.totalPaidPayoutAmount).toBeGreaterThanOrEqual(0);
  });

  test("Safely defaults empty/zero metrics to 0 or 0.0 without throwing exceptions", async ({ ownerPageA }) => {
    // Intercept and return empty/zero summary
    await ownerPageA.route("**/api/owner/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            ownerId: "11111111-1111-1111-1111-111111111111",
            totalUnits: 0,
            activeUnits: 0,
            totalBookings: 0,
            confirmedBookings: 0,
            completedBookings: 0,
            totalPaidAmount: 0.00,
            totalPendingPayoutAmount: 0.00,
            totalPaidPayoutAmount: 0.00
          }
        })
      });
    });

    await ownerPageA.goto("/owner/dashboard");
    await expect(ownerPageA.locator("main h1")).toContainText(/Dashboard/i);

    const getCardValueByLabel = (label: string) => ownerPageA.locator(`div:has(> p:text-is("${label}"))`).locator('p.text-2xl').first();

    // Verify stat cards display 0 values cleanly
    await expect(getCardValueByLabel("Units")).toContainText("0/0");
    await expect(getCardValueByLabel("Confirmed Bookings")).toContainText("0");
    await expect(getCardValueByLabel("Completed Bookings")).toContainText("0");
    await expect(getCardValueByLabel("Total Paid")).toContainText("0 EGP");
    await expect(getCardValueByLabel("Pending Payout")).toContainText("0 EGP");
  });
});
