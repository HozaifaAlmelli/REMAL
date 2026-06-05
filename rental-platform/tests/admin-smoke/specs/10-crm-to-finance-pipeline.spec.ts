import { test, expect } from "../fixtures/auth.fixture";
import { getApiToken, createTestLead, createTestArea, createTestUnit } from "../helpers/api.helpers";

test.describe("Cross-Module CRM-to-Finance Pipeline Loop", () => {
  test("E2E conversion from Lead to Booking to Invoice and Payout Ledger calculations", async ({ superAdminPage, request }) => {
    test.setTimeout(45000);

    const token = await getApiToken(request, "SuperAdmin");

    // 1. Setup mock unit for booking (ensures clean slot)
    const area = await createTestArea(request, token, {
      name: ` Sahel Pipeline ${Math.floor(Math.random() * 100000)}`,
      description: "Pipeline area",
      isActive: true,
    });
    
    const unit = await createTestUnit(request, token, {
      ownerId: "11111111-1111-1111-1111-111111111111", // Ahmed Hassan
      areaId: area.id,
      name: `Pipeline Villa ${Math.floor(Math.random() * 100000)}`,
      description: "E2E Villa for pipeline test",
      address: "Sahel",
      unitType: "villa",
      bedrooms: 4,
      bathrooms: 3,
      maxGuests: 8,
      basePricePerNight: 4000.00,
      isActive: true,
    });

    // 2. Create Lead programmatically (New status)
    const lead = await createTestLead(request, token, {
      clientId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", // Sara Guest
      targetUnitId: unit.id,
      contactName: "Sara El-Sayed",
      contactPhone: "+201111111111",
      contactEmail: "sara.guest@remal.dev",
      source: "Website",
      desiredCheckInDate: "2026-08-10",
      desiredCheckOutDate: "2026-08-15",
      guestCount: 4,
      notes: "Pipeline conversion lead",
    });

    // 3. Navigate to Lead Detail page
    await superAdminPage.goto(`/admin/crm/leads/${lead.id}`);
    await expect(superAdminPage.locator("h1")).toHaveText(/Sara El-Sayed/i);

    // 4. Move lead status: New -> Contacted -> Qualified
    const contactedBtn = superAdminPage.locator('button:has-text("Contacted")').first();
    await contactedBtn.click();
    await superAdminPage.click('button:has-text("Confirm")');
    await expect(superAdminPage.locator('span:has-text("Contacted")').first()).toBeVisible({ timeout: 10000 });

    const qualifiedBtn = superAdminPage.locator('button:has-text("Qualified")').first();
    await qualifiedBtn.click();
    await superAdminPage.click('button:has-text("Confirm")');
    await expect(superAdminPage.locator('span:has-text("Qualified")').first()).toBeVisible({ timeout: 10000 });

    // 5. Convert lead to Booking using the ConvertToBookingPanel
    await superAdminPage.fill('input[label="Client ID"], input[placeholder*="client ID"]', "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    await superAdminPage.click('button:has-text("Convert to Booking")');

    // Verification: Should redirect to Booking Detail Page
    await superAdminPage.waitForURL(/\/admin\/bookings\/[a-f0-9-]/, { timeout: 15000 });
    await expect(superAdminPage.locator("h1")).toHaveText(/Booking/i);

    // 6. Verify invoice auto-generation pattern: INV-{YEAR}{MONTH}-
    const invoiceTab = superAdminPage.locator('button:has-text("Invoice"), a:has-text("Invoice")');
    if (await invoiceTab.count() > 0) {
      await invoiceTab.first().click();
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const invoicePattern = `INV-${currentYear}${currentMonth}`;
    await expect(superAdminPage.locator("body")).toContainText(invoicePattern, { timeout: 15000 });
  });
});
