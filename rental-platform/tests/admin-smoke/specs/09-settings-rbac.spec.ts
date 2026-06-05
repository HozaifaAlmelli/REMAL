import { test, expect } from "../fixtures/auth.fixture";

test.describe("Role-Based Access Control (RBAC) Verification", () => {
  // --- SALES ROLE ---
  test("Sales role has access to CRM but not Finance", async ({ salesPage }) => {
    await salesPage.goto("/admin/dashboard");
    
    const crmLink = salesPage.locator('nav a:has-text("CRM")');
    const financeLink = salesPage.locator('nav a:has-text("Finance")');
    
    await expect(crmLink).toBeVisible();
    await expect(financeLink).not.toBeVisible();

    await salesPage.goto("/admin/finance");
    await salesPage.waitForURL("**/admin/dashboard");
    await expect(salesPage).toHaveURL(/\/admin\/dashboard/);
  });

  // --- FINANCE ROLE ---
  test("Finance role has access to Finance but not CRM", async ({ financePage }) => {
    await financePage.goto("/admin/dashboard");

    const financeLink = financePage.locator('nav a:has-text("Finance")');
    const crmLink = financePage.locator('nav a:has-text("CRM")');

    await expect(financeLink).toBeVisible();
    await expect(crmLink).not.toBeVisible();

    await financePage.goto("/admin/crm");
    await financePage.waitForURL("**/admin/dashboard");
    await expect(financePage).toHaveURL(/\/admin\/dashboard/);
  });

  // --- TECH ROLE ---
  test("Tech role has access to Units setup but not Finance", async ({ techPage }) => {
    await techPage.goto("/admin/dashboard");

    const unitsLink = techPage.locator('nav a:has-text("Units")');
    const financeLink = techPage.locator('nav a:has-text("Finance")');

    await expect(unitsLink).toBeVisible();
    await expect(financeLink).not.toBeVisible();

    await techPage.goto("/admin/finance");
    await techPage.waitForURL("**/admin/dashboard");
    await expect(techPage).toHaveURL(/\/admin\/dashboard/);
  });

  // --- SUPERADMIN ROLE ---
  test("SuperAdmin role has unfettered access across all modules", async ({ superAdminPage }) => {
    await superAdminPage.goto("/admin/dashboard");

    await expect(superAdminPage.locator('nav a:has-text("CRM")')).toBeVisible();
    await expect(superAdminPage.locator('nav a:has-text("Finance")')).toBeVisible();
    await expect(superAdminPage.locator('nav a:has-text("Units")')).toBeVisible();
    await expect(superAdminPage.locator('nav a:has-text("Areas")')).toBeVisible();

    // Accessing settings should be allowed
    await superAdminPage.goto("/admin/settings");
    await expect(superAdminPage.locator("h1")).toHaveText(/Settings/i);
  });
});
