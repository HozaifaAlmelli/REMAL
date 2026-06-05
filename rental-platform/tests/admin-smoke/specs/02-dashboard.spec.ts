import { test, expect } from "../fixtures/auth.fixture";

test.describe("Admin Dashboard Overview", () => {
  test("Loads dashboard metrics and aggregates cleanly", async ({ superAdminPage }) => {
    // Navigate to dashboard
    await superAdminPage.goto("/admin/dashboard");
    
    // Assert page header
    const header = superAdminPage.locator("h1");
    await expect(header).toHaveText(/Dashboard Overview/i);

    // Verify presence of metric cards
    const activeUnitsCard = superAdminPage.locator('div:has-text("Total Active Units")').last();
    const activeBookingsCard = superAdminPage.locator('div:has-text("Active Bookings")').last();
    const totalRevenueCard = superAdminPage.locator('div:has-text("Total Revenue")').last();

    await expect(activeUnitsCard).toBeVisible();
    await expect(activeBookingsCard).toBeVisible();
    await expect(totalRevenueCard).toBeVisible();

    // UI/UX Scan Assertion: Ensure no metric displays as empty or contains raw code strings/braces
    const cardValues = superAdminPage.locator(".text-2xl, .text-3xl");
    const count = await cardValues.count();
    for (let i = 0; i < count; i++) {
      const text = await cardValues.nth(i).innerText();
      expect(text.trim()).not.toBe("");
      expect(text).not.toContain("{");
      expect(text).not.toContain("}");
    }
  });

  test("Renders analytics charts and widgets successfully", async ({ superAdminPage }) => {
    await superAdminPage.goto("/admin/dashboard");

    // Wait for the widgets/charts containers to be visible
    const chartContainers = superAdminPage.locator(".recharts-responsive-container, svg");
    await expect(chartContainers.first()).toBeVisible({ timeout: 10000 });

    // Assert that Occupancy Widget and Active Units list render
    const occupancyWidget = superAdminPage.locator('h3:has-text("Occupancy Rate")').first();
    const activeUnitsWidget = superAdminPage.locator('h3:has-text("Active Units")').first();

    await expect(occupancyWidget).toBeVisible();
    await expect(activeUnitsWidget).toBeVisible();
  });
});
