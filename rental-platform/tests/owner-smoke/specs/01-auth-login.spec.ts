import { test, expect } from "@playwright/test";
import { loginAsOwner, hideDevtools } from "../fixtures/auth.fixture";
import { OWNER_USERS } from "../fixtures/test-data";

test.describe("Owner Portal Authentication & Access Control", () => {
  test("Redirects unauthenticated users to owner login page", async ({ page }) => {
    await page.goto("/owner/dashboard");
    await page.waitForURL("**/auth/owner/login");
    await expect(page.locator("h2")).toContainText(/Owner Login/i);
  });

  test("Shows error with invalid credentials", async ({ page }) => {
    await hideDevtools(page);
    await page.goto("/auth/owner/login");
    await page.fill('input[type="tel"]', "+201000000000");
    await page.fill('input[type="password"]', "WrongPassword");
    await page.click('button[type="submit"]');

    const errorDiv = page.locator('div.text-error');
    await expect(errorDiv).toBeVisible({ timeout: 5000 });
  });

  test("Both Owner A and Owner B can login successfully and access dashboard", async ({ page }) => {
    // Owner A
    await loginAsOwner(page, "OwnerA");
    await expect(page.locator("main h1")).toContainText(/Dashboard/i);
    
    // Sign out
    await page.click('button:has-text("Logout")');
    await page.waitForURL("**/auth/owner/login");

    // Owner B
    await loginAsOwner(page, "OwnerB");
    await expect(page.locator("main h1")).toContainText(/Dashboard/i);
  });

  test("Logging out clears session and redirects to login", async ({ page }) => {
    await loginAsOwner(page, "OwnerA");
    await page.click('button:has-text("Logout")');
    await page.waitForURL("**/auth/owner/login");

    // Attempt back to dashboard
    await page.goto("/owner/dashboard");
    await page.waitForURL("**/auth/owner/login");
  });
});
