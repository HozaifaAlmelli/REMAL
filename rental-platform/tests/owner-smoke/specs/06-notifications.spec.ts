import { test, expect } from "../fixtures/auth.fixture";

test.describe("Owner Portal Notifications Module", () => {
  test("Can view notifications inbox, check timezone offsets, template variables, and open detail modal", async ({ ownerPageA }) => {
    // Current time in ISO format with UTC 'Z' suffix
    const currentIsoUtcTime = new Date().toISOString();

    // Mock the notifications endpoint with specific scenarios
    await ownerPageA.route("**/api/owner/me/notifications/inbox", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              notificationId: "99999999-9999-9999-9999-999999999999",
              channel: "InApp",
              notificationStatus: "sent",
              subject: "New Booking Confirmed for Sahel Villa",
              body: "Your unit Sahel Villa has a new stay confirmed from July 10 to July 15. Please ensure check-in readiness.",
              createdAt: currentIsoUtcTime,
              sentAt: currentIsoUtcTime,
              readAt: null
            }
          ]
        })
      });
    });

    await ownerPageA.goto("/owner/notifications");
    await expect(ownerPageA.locator("main h1")).toContainText(/Notifications/i);

    const relativeTimeSpan = ownerPageA
      .locator("span")
      .filter({ hasText: /just now|seconds ago/i })
      .first();
    await expect(relativeTimeSpan).toBeVisible({ timeout: 5000 });

    const bodyText = await ownerPageA.innerText("body");
    expect(bodyText).not.toContain("{unitName}");
    expect(bodyText).not.toContain("{checkInDate}");
    expect(bodyText).not.toContain("{checkOutDate}");

    const notificationItem = ownerPageA
      .locator('div:has-text("New Booking Confirmed for Sahel Villa")')
      .last();
    await notificationItem.click();

    const modalTitle = ownerPageA.locator("h2#modal-title");
    await expect(modalTitle).toContainText("New Booking Confirmed for Sahel Villa");

    const modalBody = ownerPageA.locator('div[class*="break-words"]');
    await expect(modalBody).toContainText("Your unit Sahel Villa has a new stay confirmed");
    await ownerPageA.click('button:has-text("Close")');
    await expect(modalTitle).not.toBeVisible();
  });
});
