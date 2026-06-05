import { test, expect } from "../fixtures/auth.fixture";

test.describe("Finance Module & Payments Ledger", () => {
  test("Can view finance overview, navigate to payments, and inspect transaction properties", async ({ superAdminPage }) => {
    // 1. Navigate to Finance Overview
    await superAdminPage.goto("/admin/finance");
    await expect(superAdminPage.locator("h1")).toHaveText(/Finance Overview/i);

    // Verify summary metrics card display
    const totalInvoiced = superAdminPage.locator('div:has-text("Total Invoiced")').last();
    const totalPaid = superAdminPage.locator('div:has-text("Total Paid")').last();
    await expect(totalInvoiced).toBeVisible();
    await expect(totalPaid).toBeVisible();

    // 2. Go to Payments List
    await superAdminPage.click('a:has-text("View All Payments")');
    await superAdminPage.waitForURL("**/admin/finance/payments");
    await expect(superAdminPage.locator("h1")).toHaveText(/All Payments/i);

    // Verify Payments Table loads
    const paymentsTable = superAdminPage.locator("table");
    await expect(paymentsTable).toBeVisible();

    // Assert currency format in table cells (should contain formatted decimal amounts)
    // The formatCurrency helper outputs with symbols and decimal places (e.g. "SAR 5,000.00" or similar)
    const amountCells = superAdminPage.locator("tbody tr td:nth-child(3)");
    const cellCount = await amountCells.count();
    
    if (cellCount > 0) {
      const firstAmountText = await amountCells.first().innerText();
      // Verify it contains a decimal place representing decimal formatting (.00 or similar)
      expect(firstAmountText).toMatch(/\.\d{2}/);
    }
  });
});
