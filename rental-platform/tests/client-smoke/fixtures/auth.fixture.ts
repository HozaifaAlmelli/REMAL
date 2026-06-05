import { test as base, Page } from "@playwright/test";
import { ADMIN_USERS, OWNER_USERS } from "./test-data";
import {
  deactivateClient,
  getAdminApiToken,
  registerGeneratedClient,
} from "../helpers/api.helpers";

export async function hideDevtools(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      button[aria-label="Open Tanstack query devtools"],
      .tsqd-parent-container {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  });
}

export async function loginAsAdmin(
  page: Page,
  userKey: keyof typeof ADMIN_USERS = "SuperAdmin"
) {
  await hideDevtools(page);
  const credentials = ADMIN_USERS[userKey];
  await page.goto("/auth/admin/login");
  await page.getByLabel(/email/i).fill(credentials.email);
  await page.getByLabel(/password/i).fill(credentials.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin/dashboard");
}

export async function loginAsOwner(
  page: Page,
  userKey: keyof typeof OWNER_USERS = "OwnerA"
) {
  await hideDevtools(page);
  const credentials = OWNER_USERS[userKey];
  await page.goto("/auth/owner/login");
  await page.locator('input[type="tel"]').fill(credentials.phone);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/owner/dashboard");
}

export async function loginAsClient(
  page: Page,
  phone: string,
  password: string
) {
  await hideDevtools(page);
  await page.goto("/auth/client/login");
  await page.getByLabel(/phone number/i).fill(phone);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/account");
}

type ClientFixtures = {
  clientPage: Page;
  adminPage: Page;
  ownerPageA: Page;
};

export const test = base.extend<ClientFixtures>({
  clientPage: async ({ browser, request }, use) => {
    const client = await registerGeneratedClient(request);
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsClient(page, client.phone, client.password);
    await use(page);
    await context.close();

    try {
      const adminToken = await getAdminApiToken(request);
      await deactivateClient(request, adminToken, client.id);
    } catch {
      // Suite-level cleanup also scans CLI_SMOKE_ clients.
    }
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsAdmin(page, "SuperAdmin");
    await use(page);
    await context.close();
  },
  ownerPageA: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsOwner(page, "OwnerA");
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
