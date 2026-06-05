import { Page } from "@playwright/test";
import { test, expect } from "../fixtures/auth.fixture";
import {
  authHeaders,
  checkAvailability,
  getAdminApiToken,
  getClientApiToken,
  getClientBookings,
  getInternalLead,
  getOwnerApiToken,
  getPaymentsByBooking,
  uniqueEgyptianPhone,
} from "../helpers/api.helpers";
import { apiUrl } from "../helpers/smoke-env";
import {
  formatExpectedCurrency,
  generateFutureStay,
  pollUntil,
} from "../helpers/assertions";
import {
  cleanupClientSmokeData,
  createCleanupRegistry,
} from "../helpers/cleanup.helpers";
import { createSmokePublicUnit } from "../helpers/setup.helpers";
import { CLIENT_PASSWORD, TEST_PREFIX } from "../fixtures/test-data";

async function createLeadThroughClientCheckout(
  page: Page,
  unitId: string,
  stay: { checkInDate: string; checkOutDate: string },
  guestCount: string,
  client: { name: string; phone: string; email: string; password: string }
): Promise<string> {
  await page.goto(`/units/${unitId}`);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(stay.checkInDate);
  await dateInputs.nth(1).fill(stay.checkOutDate);
  await page.locator("select").first().selectOption(guestCount);
  await expect(page.getByText(/available for selected dates/i)).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /book now/i }).click();

  await page.waitForURL(`**/units/${unitId}/book**`);
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByLabel(/full name/i).fill(client.name);
  await page.getByLabel(/phone number/i).fill(client.phone);
  await page.getByLabel(/email/i).fill(client.email);
  await page.getByLabel(/^password/i).fill(client.password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("heading", { name: /review & submit/i })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /submit booking request/i }).click();
  await page.waitForURL("**/booking-confirmation?id=**", { timeout: 20_000 });

  const leadId = new URL(page.url()).searchParams.get("id");
  expect(leadId).toBeTruthy();
  return leadId!;
}

async function moveLead(adminPage: Page, status: "Contacted" | "Qualified") {
  await adminPage.getByRole("button", { name: new RegExp(status, "i") }).click();
  await adminPage.getByRole("button", { name: /^confirm$/i }).click();
  await expect(adminPage.locator("body")).toContainText(status, {
    timeout: 10_000,
  });
}

async function runBookingAction(
  adminPage: Page,
  trigger: RegExp,
  confirm: RegExp,
  expectedStatus: string
) {
  await adminPage.getByRole("button", { name: trigger }).first().click();
  const dialog = adminPage.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirm }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(adminPage.locator("body")).toContainText(expectedStatus, {
    timeout: 15_000,
  });
}

test.describe.serial("Client to admin to owner synchronization", () => {
  const registry = createCleanupRegistry();
  let adminToken = "";
  let unitId = "";
  let unitName = "";
  const stay = generateFutureStay(90, 2);

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminApiToken(request);
    const setup = await createSmokePublicUnit(request, adminToken, registry, {
      namePrefix: `${TEST_PREFIX}Sync`,
      unitType: "villa",
      basePricePerNight: 1750,
      maxGuests: 4,
    });
    unitId = setup.unit.id;
    unitName = setup.unit.name;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupClientSmokeData(request, adminToken, registry);
  });

  test("propagates checkout lead through admin confirmation into client ledger and owner availability", async ({
    page,
    adminPage,
    request,
  }) => {
    test.setTimeout(90_000);

    const client = {
      name: `${TEST_PREFIX}SyncClient_${Date.now()}`,
      phone: uniqueEgyptianPhone(),
      email: `client-sync-${Date.now()}@example.test`,
      password: CLIENT_PASSWORD,
    };

    const leadId = await createLeadThroughClientCheckout(
      page,
      unitId,
      stay,
      "2",
      client
    );
    registry.leadIds.push(leadId);

    const lead = await getInternalLead(request, adminToken, leadId);
    expect(lead.clientId).toBeTruthy();
    registry.clientIds.push(lead.clientId!);

    await adminPage.goto(`/admin/crm/leads/${leadId}`);
    await expect(adminPage.locator("body")).toContainText(client.name);
    await moveLead(adminPage, "Contacted");
    await moveLead(adminPage, "Qualified");
    await adminPage.getByRole("button", { name: /convert to booking/i }).click();
    await adminPage.waitForURL("**/admin/bookings/**", { timeout: 20_000 });

    const bookingId = adminPage.url().split("/").pop();
    expect(bookingId).toBeTruthy();
    registry.bookingIds.push(bookingId!);

    await runBookingAction(
      adminPage,
      /mark as booked/i,
      /mark as booked/i,
      "Booked"
    );
    await runBookingAction(
      adminPage,
      /confirm booking/i,
      /confirm booking/i,
      "Confirmed"
    );

    await adminPage.getByRole("button", { name: /record payment/i }).click();
    await adminPage.getByLabel(/amount/i).fill("500");
    await adminPage.getByLabel(/reference number/i).fill(`CLI-${Date.now()}`);
    await adminPage.getByRole("button", { name: /^record payment$/i }).last().click();
    await expect(adminPage.locator("body")).toContainText("500.00", {
      timeout: 15_000,
    });
    const payments = await getPaymentsByBooking<{ id: string }>(
      request,
      adminToken,
      bookingId!
    );
    registry.paymentIds.push(...payments.items.map((payment) => payment.id));

    const clientToken = await getClientApiToken(
      request,
      client.phone,
      client.password
    );
    const confirmedRow = await pollUntil(
      () => getClientBookings(request, clientToken),
      (bookings) =>
        bookings.items.some(
          (item) => item.id === bookingId && item.bookingStatus === "Confirmed"
        ),
      { description: "client bookings to include confirmed booking" }
    );
    const booking = confirmedRow.items.find((item) => item.id === bookingId);
    expect(booking).toBeTruthy();

    await page.goto("/account/bookings");
    await page.bringToFront();
    await expect(page.getByRole("cell", { name: unitName })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("body")).toContainText("Confirmed");
    await expect(page.locator("body")).toContainText(
      formatExpectedCurrency(booking!.finalAmount)
    );

    const availability = await checkAvailability(
      request,
      unitId,
      stay.checkInDate,
      stay.checkOutDate
    );
    expect(availability.isAvailable).toBe(false);
    expect(availability.blockedDates).toEqual(
      expect.arrayContaining([stay.checkInDate])
    );

    const ownerToken = await getOwnerApiToken(request, "OwnerA");
    const ownerUnitResponse = await request.get(
      apiUrl(`/api/owner/units/${unitId}`),
      { headers: authHeaders(ownerToken) }
    );
    expect(ownerUnitResponse.ok()).toBe(true);
  });
});
