import { test, expect } from "../fixtures/auth.fixture";

test.describe("Areas Management Module", () => {
  test("Can create, edit, toggle status of an Area with persistence", async ({ superAdminPage }) => {
    // Set higher timeout for DB mutation lag
    test.setTimeout(45000);

    // 1. Navigate to Areas Page
    await superAdminPage.goto("/admin/areas");
    await expect(superAdminPage.locator("h1")).toHaveText(/Areas/i);

    // 2. Create a new Area
    const areaName = `Sahel_${Math.floor(Math.random() * 100000)}`;
    const areaDesc = "Smoke test area description";

    await superAdminPage.click('button:has-text("New Area")');
    await superAdminPage.fill("#name", areaName);
    await superAdminPage.fill("#description", areaDesc);
    await superAdminPage.click('button[type="submit"]');

    // Confirm success in the list
    const areaRow = superAdminPage.locator(`tr:has-text("${areaName}")`);
    await expect(areaRow).toBeVisible({ timeout: 15000 });
    
    const statusCell = areaRow.locator('td:nth-child(3)');
    await expect(statusCell).toHaveText("Active");

    // 3. Toggle status to inactive
    const toggleBtn = areaRow.locator('button[aria-label="Deactivate Area"]');
    await expect(toggleBtn).toBeVisible({ timeout: 5000 });
    await superAdminPage.waitForTimeout(1000);
    await toggleBtn.click({ force: true });

    // Confirm dialog
    const confirmBtn = superAdminPage.locator('button:has-text("Deactivate Area"), button:has-text("Confirm")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click({ force: true });

    // Verify Inactive state
    await expect(statusCell).toHaveText("Inactive", { timeout: 15000 });

    // 4. Reload page and check persistence
    await superAdminPage.reload();
    const areaRowReloaded = superAdminPage.locator(`tr:has-text("${areaName}")`);
    await expect(areaRowReloaded).toBeVisible({ timeout: 15000 });
    await expect(areaRowReloaded.locator('td:nth-child(3)')).toHaveText("Inactive");
  });
});
