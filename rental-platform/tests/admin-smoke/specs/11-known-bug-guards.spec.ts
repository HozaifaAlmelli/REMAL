import { test, expect } from "../fixtures/auth.fixture";
import { getApiToken } from "../helpers/api.helpers";

test.describe("Known Historical Bugs & Contract Gaps Regression Guards", () => {
  // Bug 1: finalAmount displaying as 0 due to missing unwrapping logic
  test("finalAmount in payments and invoices is non-zero and formatted properly", async ({ superAdminPage }) => {
    await superAdminPage.goto("/admin/finance/payments");
    
    // Check that we have payment rows
    const paymentsTable = superAdminPage.locator("table");
    await expect(paymentsTable).toBeVisible();

    // Verify first amount cell does not read "0" or "0.00" if seed payments exist
    const amountCells = superAdminPage.locator("tbody tr td:nth-child(3)");
    const cellCount = await amountCells.count();
    
    if (cellCount > 0) {
      const amountText = await amountCells.first().innerText();
      expect(amountText.trim()).not.toBe("0");
      expect(amountText.trim()).not.toBe("SAR 0.00");
      expect(amountText.trim()).not.toBe("EGP 0.00");
    }
  });

  // Bug 2: 404 Not Found on admin notification dispatch breaking the browser loop
  test("404 error on invalid notification dispatch is handled gracefully", async ({ superAdminPage, request }) => {
    // Navigate to admin notifications center
    await superAdminPage.goto("/admin/notifications");
    await expect(superAdminPage.locator("h1")).toHaveText(/Notifications/i);

    const token = await getApiToken(request, "SuperAdmin");

    // Call API directly with invalid admin ID, verify standard bad request envelope
    const invalidDispatch = await request.post("http://localhost:5001/api/internal/notifications/admins/invalid-uuid", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        title: "Test Alert",
        message: "E2E Test Message",
      },
    });

    // Enforce API contract envelope return instead of raw IIS/ASP.NET stack trace
    expect([400, 404, 422]).toContain(invalidDispatch.status());
    const body = await invalidDispatch.json();
    expect(body.success).toBe(false);
    expect(body.message).toBeDefined();
  });

  // Bug 3: Notification Template Variable replacement failures showing raw {unitName}
  test("Notification details container has no raw template tokens in DOM", async ({ superAdminPage }) => {
    await superAdminPage.goto("/admin/notifications");
    
    // Scan all notification card text content for raw brace variable tags
    const notificationsText = await superAdminPage.locator("body").innerText();
    expect(notificationsText).not.toContain("{unitName}");
    expect(notificationsText).not.toContain("{clientName}");
    expect(notificationsText).not.toContain("{checkInDate}");
  });

  // Bug 4: Timezone Offset Drift gap (timestamps should return UTC Kind with trailing Z)
  test("Server API responses return UTC timestamps with Z indicator", async ({ request }) => {
    const token = await getApiToken(request, "SuperAdmin");

    const response = await request.get("http://localhost:5001/api/internal/units", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await response.json();
    const firstUnit = body.data[0];
    if (firstUnit) {
      expect(firstUnit.createdAt).toMatch(/Z$/);
    }
  });

  // Bug 5: Client Name Fallback error showing general placeholder
  test("Multi-part client names render natively in list views", async ({ superAdminPage }) => {
    await superAdminPage.goto("/admin/clients");
    
    // Seed data client "Hazem Al-Melli" should render natively
    const clientRow = superAdminPage.locator('tr:has-text("Hazem Al-Melli")');
    await expect(clientRow).toBeVisible();
    
    // Ensure no fallback placeholder text is displayed instead of the name
    await expect(superAdminPage.locator('text=عميل المنصة')).not.toBeVisible();
  });
});
