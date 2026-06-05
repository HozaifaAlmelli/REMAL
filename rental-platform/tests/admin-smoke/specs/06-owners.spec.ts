import { test, expect } from "../fixtures/auth.fixture";

test.describe("Owners Management Module", () => {
  test("Can view owner profile, verify commission rate presentation, and check units list", async ({ superAdminPage }) => {
    // 1. Navigate to Owners list
    await superAdminPage.goto("/admin/owners");
    await expect(superAdminPage.locator("h1")).toHaveText(/Owners/i);

    // Assert that owners are listed (e.g. Ahmed Hassan)
    const ownerRow = superAdminPage.locator('tr:has-text("Ahmed Hassan")').first();
    await expect(ownerRow).toBeVisible();

    // Verify commission rate presentation in list
    // Ahmed Hassan has 10.00% commission, shown as 10% or 10.00%
    await expect(ownerRow).toContainText("10");

    // 2. Click Ahmed Hassan to navigate to detail view
    await ownerRow.locator('a, button').first().click();
    await superAdminPage.waitForURL(/\/admin\/owners\/[a-f0-9-]/);

    // Verify detail page header
    await expect(superAdminPage.locator("h1")).toHaveText(/Ahmed Hassan/i);

    // Verify commission rate on details page (contains 10%)
    await expect(superAdminPage.locator("body")).toContainText("10");

    // 3. Check Units tab/section
    const unitsSection = superAdminPage.locator('h2:has-text("Units")');
    await expect(unitsSection).toBeVisible();
    
    // Ahmed Hassan has seed units like "Luxury 2BR Apartment"
    const unitListItem = superAdminPage.locator('text=Luxury 2BR Apartment').first();
    await expect(unitListItem).toBeVisible();
  });
});
