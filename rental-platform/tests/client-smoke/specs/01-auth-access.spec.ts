import { test, expect, loginAsAdmin, loginAsClient } from "../fixtures/auth.fixture";
import {
  deactivateClient,
  getAdminApiToken,
  registerGeneratedClient,
} from "../helpers/api.helpers";

test.describe.serial("Client auth and guarded access", () => {
  const generatedClientIds: string[] = [];

  test.afterAll(async ({ request }) => {
    const adminToken = await getAdminApiToken(request);
    for (const clientId of generatedClientIds) {
      await deactivateClient(request, adminToken, clientId);
    }
  });

  test("redirects anonymous visitors from account routes to client login", async ({
    page,
  }) => {
    await page.goto("/account/bookings");
    await page.waitForURL("**/auth/client/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("logs in and logs out a generated client", async ({ page, request }) => {
    const client = await registerGeneratedClient(request);
    generatedClientIds.push(client.id);

    await loginAsClient(page, client.phone, client.password);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText(client.name)).toBeVisible();

    await page.getByRole("button", { name: /log out/i }).click();
    await page.waitForURL("**/auth/client/login");

    await page.goto("/account");
    await page.waitForURL("**/auth/client/login");
  });

  test("keeps admin sessions out of client account pages", async ({ page }) => {
    await loginAsAdmin(page, "SuperAdmin");
    await page.goto("/account");
    await page.waitForURL("**/admin/dashboard");
    await expect(page.locator("body")).toContainText(/dashboard/i);
  });
});
