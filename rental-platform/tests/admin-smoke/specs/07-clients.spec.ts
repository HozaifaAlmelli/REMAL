import { test, expect } from "../fixtures/auth.fixture";

test.describe("Clients Management Module", () => {
  test("Can view clients list, navigate to client details, and verify name rendering", async ({ superAdminPage }) => {
    // 1. Navigate to Clients page
    await superAdminPage.goto("/admin/clients");
    await expect(superAdminPage.locator("h1")).toHaveText(/Clients/i);

    // Get the name of the first client in the table dynamically
    const firstClientRow = superAdminPage.locator("tbody tr").first();
    await expect(firstClientRow).toBeVisible({ timeout: 10000 });
    
    const clientName = await firstClientRow.locator("td").first().innerText();
    expect(clientName.trim()).not.toBe("");

    // 2. Click client to go to details view
    await firstClientRow.locator('a, button').first().click();
    await superAdminPage.waitForURL(/\/admin\/clients\/[a-f0-9-]/);

    // Verify detail header shows name natively
    const nameHeader = superAdminPage.locator("h1");
    await expect(nameHeader).toHaveText(clientName);

    // Verify Booking History table renders
    const bookingHistoryHeader = superAdminPage.locator('h2:has-text("Booking History")');
    await expect(bookingHistoryHeader).toBeVisible();
  });
});
