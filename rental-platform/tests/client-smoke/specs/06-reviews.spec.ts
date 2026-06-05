import { Page } from "@playwright/test";
import { test, expect, loginAsClient } from "../fixtures/auth.fixture";
import {
  createInternalBooking,
  getAdminApiToken,
  getClientApiToken,
  getClientReviewByBooking,
  registerGeneratedClient,
} from "../helpers/api.helpers";
import { generateFutureStay } from "../helpers/assertions";
import {
  cleanupClientSmokeData,
  createCleanupRegistry,
} from "../helpers/cleanup.helpers";
import { createSmokePublicUnit } from "../helpers/setup.helpers";
import { TEST_PREFIX } from "../fixtures/test-data";

async function bookingAction(page: Page, trigger: RegExp, confirm: RegExp) {
  await page.getByRole("button", { name: trigger }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirm }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

test.describe.serial("Client review submission and pending edit flow", () => {
  const registry = createCleanupRegistry();
  let adminToken = "";
  let bookingId = "";
  let unitName = "";
  let clientPhone = "";
  let clientPassword = "";

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminApiToken(request);
    const client = await registerGeneratedClient(request);
    registry.clientIds.push(client.id);
    clientPhone = client.phone;
    clientPassword = client.password;

    const setup = await createSmokePublicUnit(request, adminToken, registry, {
      namePrefix: `${TEST_PREFIX}Review`,
      unitType: "studio",
      basePricePerNight: 1300,
      maxGuests: 2,
    });
    unitName = setup.unit.name;

    const stay = generateFutureStay(130, 2);
    const booking = await createInternalBooking<{ id: string }>(
      request,
      adminToken,
      {
        clientId: client.id,
        unitId: setup.unit.id,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        guestCount: 2,
        source: "website",
        internalNotes: "Client smoke review booking",
      }
    );
    bookingId = booking.id;
    registry.bookingIds.push(bookingId);
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupClientSmokeData(request, adminToken, registry);
  });

  test("allows a client to create and edit a pending review for a completed stay", async ({
    page,
    adminPage,
    request,
  }) => {
    test.setTimeout(80_000);

    await adminPage.goto(`/admin/bookings/${bookingId}`);
    await bookingAction(adminPage, /mark as booked/i, /mark as booked/i);
    await expect(adminPage.locator("body")).toContainText("Booked", {
      timeout: 15_000,
    });
    await bookingAction(adminPage, /confirm booking/i, /confirm booking/i);
    await expect(adminPage.locator("body")).toContainText("Confirmed", {
      timeout: 15_000,
    });
    await bookingAction(adminPage, /check in client/i, /check in/i);
    await expect(adminPage.locator("body")).toContainText("CheckIn", {
      timeout: 15_000,
    });
    await bookingAction(adminPage, /complete booking/i, /complete booking/i);
    await expect(adminPage.locator("body")).toContainText("Completed", {
      timeout: 15_000,
    });

    await loginAsClient(page, clientPhone, clientPassword);
    await page.goto("/account/reviews");
    await expect(page.getByText(unitName)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /write review/i }).first().click();

    await page.getByRole("button", { name: /5 stars/i }).click();
    await page.getByLabel(/title/i).fill(`${TEST_PREFIX}Review title`);
    await page
      .getByPlaceholder(/share details about your stay/i)
      .fill(`${TEST_PREFIX}Review comment`);
    await page.getByRole("button", { name: /submit/i }).click();

    await expect(page.getByRole("button", { name: /my feedback history/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /my feedback history/i }).click();
    await expect(page.getByText(/pending/i)).toBeVisible();
    await expect(page.getByText(`${TEST_PREFIX}Review title`)).toBeVisible();

    const review = await getClientReviewByBooking(
      request,
      await getClientApiToken(request, clientPhone, clientPassword),
      bookingId
    );
    expect(review?.reviewStatus).toBe("Pending");

    await page.getByRole("button", { name: /edit review/i }).click();
    await page.getByLabel(/title/i).fill(`${TEST_PREFIX}Updated review`);
    await page.getByRole("button", { name: /update/i }).click();
    await expect(page.getByText(`${TEST_PREFIX}Updated review`)).toBeVisible({
      timeout: 15_000,
    });
  });
});
