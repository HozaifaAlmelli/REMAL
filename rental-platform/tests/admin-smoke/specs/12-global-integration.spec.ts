import { test, expect } from "../fixtures/auth.fixture";
import { getApiToken, createTestLead, createTestArea, createTestUnit } from "../helpers/api.helpers";

test.describe("Global Portal Integration & Edge Cases", () => {
  // 1. Network Interceptor Structural Sanity Check
  test("Axios wrapper handles network errors gracefully and shows warning toast", async ({ superAdminPage }) => {
    await superAdminPage.goto("/admin/areas");

    // Intercept POST areas request and force network failure
    await superAdminPage.route("**/api/areas", (route) => {
      if (route.request().method() === "POST") {
        return route.abort("failed");
      }
      return route.continue();
    });

    await superAdminPage.click('button:has-text("New Area")');
    await superAdminPage.fill("#name", "Failed Area");
    await superAdminPage.click('button[type="submit"]');

    // The central axios/toast handler should capture the error and display a toast/alert
    const errorToastOrAlert = superAdminPage.locator('text=Cannot reach the server').first();
    await expect(errorToastOrAlert).toBeVisible({ timeout: 10000 });
  });

  // 2. Concurrency Double-Submit Click Guard
  test("Form submit buttons are disabled on click to prevent double submission", async ({ superAdminPage }) => {
    // Intercept POST areas request and delay response to allow Playwright to check disabled status
    await superAdminPage.route("**/api/areas", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      await route.continue();
    });

    await superAdminPage.goto("/admin/areas");
    await superAdminPage.click('button:has-text("New Area")');

    const areaName = `Sahel_${Math.floor(Math.random() * 100000)}`;
    await superAdminPage.fill("#name", areaName);

    const submitBtn = superAdminPage.locator('button[type="submit"]');
    
    // Rapidly double click the submit button
    await submitBtn.dblclick();

    // Verify that the submit button gets disabled or shows a loading state
    await expect(submitBtn).toBeDisabled();
  });

  // 3. Midnight Boundary Skew check
  test("Check-in dates at midnight are preserved without timezone day offset drift", async ({ superAdminPage, request }) => {
    const token = await getApiToken(request, "SuperAdmin");

    const area = await createTestArea(request, token, {
      name: `Sahel Midnight ${Math.floor(Math.random() * 100000)}`,
      description: "Midnight boundary check area",
      isActive: true,
    });
    
    const unit = await createTestUnit(request, token, {
      ownerId: "11111111-1111-1111-1111-111111111111", // Ahmed Hassan
      areaId: area.id,
      name: `Midnight Villa ${Math.floor(Math.random() * 100000)}`,
      description: "Midnight test unit",
      address: "Sahel",
      unitType: "villa",
      bedrooms: 3,
      bathrooms: 2,
      maxGuests: 6,
      basePricePerNight: 3500.00,
      isActive: true,
    });

    const checkIn = "2026-09-01";
    const checkOut = "2026-09-10";

    const lead = await createTestLead(request, token, {
      clientId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", // Sara Guest
      targetUnitId: unit.id,
      contactName: "Midnight Guest",
      contactPhone: "+201099998888",
      contactEmail: "midnight.guest@remal.dev",
      source: "website",
      desiredCheckInDate: checkIn,
      desiredCheckOutDate: checkOut,
      guestCount: 2,
      notes: "Midnight boundary check lead",
    });

    await superAdminPage.goto(`/admin/crm/leads/${lead.id}`);

    // Wait for the lead detail view to finish loading
    await expect(superAdminPage.locator("h1")).toHaveText(/Midnight Guest/i, { timeout: 15000 });

    // Verify dates displayed on details view match exactly (formatted)
    const bodyText = await superAdminPage.locator("body").innerText();
    expect(bodyText).toContain("1 Sep 2026");
    expect(bodyText).toContain("10 Sep 2026");
  });
});
