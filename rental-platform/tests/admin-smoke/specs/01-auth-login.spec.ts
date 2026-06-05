import { test, expect } from "@playwright/test";
import { ADMIN_USERS } from "../fixtures/test-data";

test.describe("Admin Authentication & Access Control", () => {
  test("Redirects unauthenticated users to login page", async ({ page }) => {
    // Attempt to access admin dashboard directly
    await page.goto("/admin/dashboard");
    
    // Expect URL redirect to the admin login page
    await expect(page).toHaveURL(/\/auth\/admin\/login/);
  });

  test("Shows error with invalid credentials", async ({ page }) => {
    await page.goto("/auth/admin/login");

    // Input invalid email/password
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Expect an error alert to appear in the DOM
    const errorAlert = page.locator(".text-error");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toHaveText(/Invalid email or password/i);
  });

  test("Successfully logs in as SuperAdmin and redirects to dashboard", async ({ page }) => {
    await page.goto("/auth/admin/login");

    const credentials = ADMIN_USERS.SuperAdmin;
    await page.fill('input[type="email"]', credentials.email);
    await page.fill('input[type="password"]', credentials.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL("**/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Verify page header
    const header = page.locator("h1");
    await expect(header).toHaveText(/Dashboard Overview/i);
  });

  test("Logging out clears session and redirects to login page", async ({ page }) => {
    // Log in first
    await page.goto("/auth/admin/login");
    const credentials = ADMIN_USERS.SuperAdmin;
    await page.fill('input[type="email"]', credentials.email);
    await page.fill('input[type="password"]', credentials.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/dashboard");

    // Click logout button (let's locate it: sidebar usually has a sign out/logout link/button)
    const logoutBtn = page.locator('button:has-text("Sign Out"), a:has-text("Sign Out"), button:has-text("Logout"), a:has-text("Logout")');
    await logoutBtn.click();

    // Expect redirect back to login page
    await page.waitForURL("**/auth/admin/login");
    await expect(page).toHaveURL(/\/auth\/admin\/login/);

    // Verify localStorage or session is cleared
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/auth\/admin\/login/);
  });
});
