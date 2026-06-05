import { test, expect, loginAsClient } from "../fixtures/auth.fixture";
import {
  assertForbiddenOrNotFound,
  authHeaders,
  createClientBookingNotification,
  createInternalBooking,
  getAdminApiToken,
  getClientApiToken,
  getClientNotifications,
  getOwnerApiToken,
  registerGeneratedClient,
  transitionBooking,
} from "../helpers/api.helpers";
import { apiUrl } from "../helpers/smoke-env";
import { expectNoPii, generateFutureStay } from "../helpers/assertions";
import {
  cleanupClientSmokeData,
  createCleanupRegistry,
} from "../helpers/cleanup.helpers";
import { createSmokePublicUnit } from "../helpers/setup.helpers";
import { TEST_PREFIX } from "../fixtures/test-data";

test.describe.serial("Client notifications, privacy, and multitenancy isolation", () => {
  const registry = createCleanupRegistry();
  let adminToken = "";
  let ownerToken = "";
  let bookingId = "";
  let clientA = { id: "", phone: "", password: "" };
  let clientB = { id: "", phone: "", password: "" };

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminApiToken(request);
    ownerToken = await getOwnerApiToken(request, "OwnerA");

    const [generatedA, generatedB] = await Promise.all([
      registerGeneratedClient(request),
      registerGeneratedClient(request),
    ]);
    clientA = generatedA;
    clientB = generatedB;
    registry.clientIds.push(generatedA.id, generatedB.id);

    const setup = await createSmokePublicUnit(request, adminToken, registry, {
      namePrefix: `${TEST_PREFIX}Privacy`,
      unitType: "chalet",
      basePricePerNight: 1800,
      maxGuests: 4,
    });

    const stay = generateFutureStay(170, 2);
    const booking = await createInternalBooking<{ id: string }>(
      request,
      adminToken,
      {
        clientId: generatedB.id,
        unitId: setup.unit.id,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        guestCount: 2,
        source: "website",
        internalNotes: "Client smoke privacy booking",
      }
    );
    bookingId = booking.id;
    registry.bookingIds.push(bookingId);

    await transitionBooking(request, adminToken, bookingId, "booked");
    await transitionBooking(request, adminToken, bookingId, "confirm");
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupClientSmokeData(request, adminToken, registry);
  });

  test("renders generated booking notifications without raw interpolation tokens", async ({
    page,
    request,
  }) => {
    const seededNotification = await createClientBookingNotification(
      request,
      adminToken,
      clientB.id,
      "3,600.00"
    );
    const clientToken = await getClientApiToken(
      request,
      clientB.phone,
      clientB.password
    );
    const notifications = await getClientNotifications(request, clientToken);
    const bookingNotification = notifications.find(
      (notification) => notification.notificationId === seededNotification.id
    );
    expect(bookingNotification).toBeTruthy();
    expect(`${bookingNotification!.subject} ${bookingNotification!.body}`).not.toMatch(
      /\{\{|undefined|null/i
    );
    expect(bookingNotification!.subject).toBe(seededNotification.subject);
    expect(bookingNotification!.body).toBe(seededNotification.body);

    await loginAsClient(page, clientB.phone, clientB.password);
    await page.goto("/account/notifications");
    await expect(page.locator("body")).toContainText(/notifications/i);
    await expect(page.locator("body")).toContainText(seededNotification.body);
    await expect(page.locator("body")).not.toContainText("{{");

    const markRead = page.getByRole("button", { name: /mark read/i }).first();
    if (await markRead.isVisible()) {
      await markRead.click();
      await expect(page.locator("body")).toContainText(/unread/i);
    }
  });

  test("prevents Client A from reading Client B booking and keeps owner payload PII-free", async ({
    request,
  }) => {
    const clientAToken = await getClientApiToken(
      request,
      clientA.phone,
      clientA.password
    );

    const forbidden = await request.get(
      apiUrl(`/api/client/bookings/${bookingId}`),
      { headers: authHeaders(clientAToken) }
    );
    await assertForbiddenOrNotFound(forbidden);

    const ownerResponse = await request.get(
      apiUrl(`/api/owner/bookings/${bookingId}`),
      { headers: authHeaders(ownerToken) }
    );
    expect(ownerResponse.ok()).toBe(true);
    const ownerPayload = await ownerResponse.json();
    expectNoPii(ownerPayload, "owner booking payload");
  });
});
