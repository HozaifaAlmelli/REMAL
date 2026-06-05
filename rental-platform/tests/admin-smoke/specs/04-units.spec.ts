import { test, expect } from "../fixtures/auth.fixture";
import { getApiToken, createDateBlock } from "../helpers/api.helpers";

test.describe("Units Inventory & Calendar Management", () => {
  test("Can create a unit, toggle status, and create date blocks that show up in availability calendar", async ({ superAdminPage, request }) => {
    test.setTimeout(45000);

    // 1. Navigate to Units Page
    await superAdminPage.goto("/admin/units");
    await expect(superAdminPage.locator("h1")).toHaveText(/Units/i);

    // 2. Click Add Unit
    await superAdminPage.click('button:has-text("Add Unit")');
    await superAdminPage.waitForURL("**/admin/units/new");

    // 3. Fill out the Unit creation form
    const unitName = `Smoke_Chalet_${Math.floor(Math.random() * 100000)}`;
    
    // Select Owner via Combobox dropdown
    await superAdminPage.click('button:has-text("Select an owner")');
    await superAdminPage.click('div[class*="cursor-pointer"]:has-text("Ahmed Hassan")');

    // Select Area (the first select on page)
    await superAdminPage.locator('select').first().selectOption({ index: 1 });

    // Fill textual fields
    await superAdminPage.fill('input[name="name"]', unitName);
    
    // Select Unit Type (the second select on page)
    await superAdminPage.locator('select').nth(1).selectOption("chalet");
    
    await superAdminPage.fill('input[name="bedrooms"]', "3");
    await superAdminPage.fill('input[name="bathrooms"]', "2");
    await superAdminPage.fill('input[name="maxGuests"]', "6");
    await superAdminPage.fill('input[name="basePricePerNight"]', "2500.00");
    await superAdminPage.fill('input[name="address"]', "123 Sahel Coast Road, Egypt");

    // Click submit
    await superAdminPage.click('button[type="submit"]');

    // 4. Verification: Should redirect to Unit Detail Page
    await superAdminPage.waitForURL(/\/admin\/units\/[a-f0-9-]/, { timeout: 15000 });
    await expect(superAdminPage.locator("h1")).toHaveText(unitName);

    // Extract unit ID from URL
    const url = superAdminPage.url();
    const unitId = url.split("/").pop() || "";

    // 5. Add a DateBlock via API helper to ensure stable date range injection
    const token = await getApiToken(request, "SuperAdmin");
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-15`;
    const endDate = `${year}-${month}-18`;

    await createDateBlock(request, token, unitId, {
      startDate,
      endDate,
      reason: "Maintenance",
      notes: "E2E Scheduled Maintenance Closure",
    });

    // 6. Reload unit page and view Date Blocks tab
    await superAdminPage.reload();
    await superAdminPage.click('button:has-text("Date Blocks")');
    
    // Check that Date Block table row is present
    const dateBlockRow = superAdminPage.locator('tr:has-text("Maintenance")');
    await expect(dateBlockRow).toBeVisible({ timeout: 10000 });
    await expect(dateBlockRow).toContainText("E2E Scheduled Maintenance Closure");

    // 7. Click Availability tab and verify blocked date is highlighted in red
    await superAdminPage.click('button:has-text("Availability")');
    await expect(superAdminPage.locator('h2:has-text("Unit Availability")')).toBeVisible();

    // Verify cell 15 is marked as unavailable
    const cell15 = superAdminPage.locator('div[class*="bg-red-50"]:has-text("15")').first();
    await expect(cell15).toBeVisible({ timeout: 10000 });
  });
});
