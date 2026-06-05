import { test as base, Page } from "@playwright/test";
import { OWNER_USERS, ADMIN_USERS } from "./test-data";

// Helper to hide Devtools
export async function hideDevtools(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      button[aria-label="Open Tanstack query devtools"],
      .tsqd-parent-container {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  });
}

// Helper to log in an owner
export async function loginAsOwner(page: Page, userKey: keyof typeof OWNER_USERS) {
  await hideDevtools(page);
  const credentials = OWNER_USERS[userKey];
  await page.goto("/auth/owner/login");
  await page.fill('input[type="tel"]', credentials.phone);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/owner/dashboard");
}

// Helper to log in an admin
export async function loginAsAdmin(page: Page, userKey: keyof typeof ADMIN_USERS) {
  await hideDevtools(page);
  const credentials = ADMIN_USERS[userKey];
  await page.goto("/auth/admin/login");
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin/dashboard");
}

type OwnerFixtures = {
  ownerPageA: Page;
  ownerPageB: Page;
  adminPage: Page;
};

export const test = base.extend<OwnerFixtures>({
  ownerPageA: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsOwner(page, "OwnerA");
    await use(page);
    await context.close();
  },
  ownerPageB: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsOwner(page, "OwnerB");
    await use(page);
    await context.close();
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsAdmin(page, "SuperAdmin");
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
