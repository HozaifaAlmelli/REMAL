import { test as base, Page } from "@playwright/test";
import { ADMIN_USERS } from "./test-data";

// Helper to log in a page
export async function loginAs(page: Page, role: keyof typeof ADMIN_USERS) {
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

  const credentials = ADMIN_USERS[role];
  await page.goto("/auth/admin/login");
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin/dashboard");
}

type AdminFixtures = {
  superAdminPage: Page;
  salesPage: Page;
  financePage: Page;
  techPage: Page;
};

export const test = base.extend<AdminFixtures>({
  superAdminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, "SuperAdmin");
    await use(page);
    await context.close();
  },
  salesPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, "Sales");
    await use(page);
    await context.close();
  },
  financePage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, "Finance");
    await use(page);
    await context.close();
  },
  techPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, "Tech");
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
