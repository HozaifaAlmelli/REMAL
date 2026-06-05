import { test, expect } from "../fixtures/auth.fixture";
import {
  calculatePricing,
  getAdminApiToken,
  getClientApiToken,
  getClientBookings,
  getInternalLead,
  uniqueEgyptianPhone,
} from "../helpers/api.helpers";
import {
  expectMoneyFormat,
  formatExpectedCurrency,
  generateFutureStay,
} from "../helpers/assertions";
import {
  cleanupClientSmokeData,
  createCleanupRegistry,
} from "../helpers/cleanup.helpers";
import { createSmokePublicUnit } from "../helpers/setup.helpers";
import { CLIENT_PASSWORD, TEST_PREFIX } from "../fixtures/test-data";

test.describe.serial("Client seamless booking signup and bookings ledger", () => {
  const registry = createCleanupRegistry();
  let adminToken = "";
  let unitId = "";
  let unitName = "";
  const stay = generateFutureStay(45, 3);

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminApiToken(request);
    const setup = await createSmokePublicUnit(request, adminToken, registry, {
      namePrefix: `${TEST_PREFIX}Booking`,
      unitType: "chalet",
      basePricePerNight: 1500,
      maxGuests: 5,
    });
    unitId = setup.unit.id;
    unitName = setup.unit.name;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupClientSmokeData(request, adminToken, registry);
  });

  test("registers inline, creates exactly one lead, and shows finalAmount in bookings", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);

    const phone = uniqueEgyptianPhone();
    const clientName = `${TEST_PREFIX}Checkout_${Date.now()}`;
    const email = `checkout-${Date.now()}@example.test`;
    const expectedPricing = await calculatePricing(
      request,
      unitId,
      stay.checkInDate,
      stay.checkOutDate
    );

    await page.goto(`/units/${unitId}`);
    await expect(page.getByRole("heading", { name: unitName })).toBeVisible();

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(stay.checkInDate);
    await dateInputs.nth(1).fill(stay.checkOutDate);
    await page.locator("select").first().selectOption("2");
    await expect(page.getByText(/available for selected dates/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /book now/i }).click();

    await page.waitForURL(`**/units/${unitId}/book**`);
    await expect(page.getByRole("heading", { name: /booking details/i })).toBeVisible();
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page.getByRole("heading", { name: /your details/i })).toBeVisible();
    await page.getByLabel(/full name/i).fill(clientName);
    await page.getByLabel(/phone number/i).fill(phone);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password/i).fill(CLIENT_PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByRole("heading", { name: /review & submit/i })).toBeVisible({
      timeout: 20_000,
    });

    const submitButton = page.getByRole("button", {
      name: /submit booking request/i,
    });
    await Promise.all([
      submitButton.click(),
      submitButton.click().catch(() => undefined),
    ]);

    await page.waitForURL("**/booking-confirmation?id=**", { timeout: 20_000 });
    const currentUrl = new URL(page.url());
    const leadId = currentUrl.searchParams.get("id");
    expect(leadId).toBeTruthy();
    registry.leadIds.push(leadId!);

    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === "refresh_token")).toBe(true);

    const lead = await getInternalLead(request, adminToken, leadId!);
    expect(lead.contactPhone).toBe(phone);
    expect(lead.targetUnitId).toBe(unitId);
    expect(lead.leadStatus).toBe("New");
    expect(lead.clientId).toBeTruthy();
    registry.clientIds.push(lead.clientId!);

    const clientToken = await getClientApiToken(request, phone, CLIENT_PASSWORD);
    const bookings = await getClientBookings(request, clientToken);
    const bookingRow = bookings.items.find((item) => item.id === leadId);
    expect(bookingRow).toBeTruthy();
    expect(bookingRow!.bookingStatus).toBe("Prospecting");
    expect(bookingRow!.finalAmount).toBe(expectedPricing.totalPrice);

    await page.goto("/account/bookings");
    await expect(page.getByRole("cell", { name: unitName })).toBeVisible();
    const pageText = await page.locator("body").innerText();
    expect(pageText).toContain(formatExpectedCurrency(expectedPricing.totalPrice));
    expectMoneyFormat(formatExpectedCurrency(expectedPricing.totalPrice));
  });
});
