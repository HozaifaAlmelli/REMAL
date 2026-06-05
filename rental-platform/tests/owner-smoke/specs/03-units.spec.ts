import { test, expect } from "../fixtures/auth.fixture";

test.describe("Owner Portal Units Module", () => {
  test("Can browse units in read-only mode and verify unit details", async ({ ownerPageA }) => {
    await ownerPageA.goto("/owner/units");
    await expect(ownerPageA.locator("main h1")).toContainText(/My Units/i);

    // Verify list is loaded
    const unitCards = ownerPageA.locator('main a:has(h3)');
    await expect(unitCards.first()).toBeVisible({ timeout: 10000 });

    // Assert that no Create or Add Unit buttons exist
    const addBtn = ownerPageA.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add")');
    await expect(addBtn).not.toBeVisible();

    // Verify unit type is lowercase (e.g. chalet, villa, studio) in the badges
    const typeBadges = ownerPageA.locator('span[class*="badge"], span[class*="Badge"]');
    if (await typeBadges.count() > 0) {
      const texts = await typeBadges.allTextContents();
      for (const text of texts) {
        // Skip status badges like "Active" or "Inactive"
        if (text === "Active" || text === "Inactive") continue;
        // Verify unit type lowercase match
        expect(text.toLowerCase()).toEqual(text);
        expect(["villa", "chalet", "studio"]).toContain(text);
      }
    }

    // Click on the first unit card to navigate to details
    const firstCard = ownerPageA.locator('main a:has(h3)').first();
    await firstCard.click();
    await ownerPageA.waitForURL(/\/owner\/units\/[a-f0-9-]/, { timeout: 10000 });

    // Verify read-only status on details page (no Edit/Delete buttons or inputs)
    await expect(ownerPageA.locator("main h1")).toBeVisible();
    const editBtn = ownerPageA.locator('button:has-text("Edit"), button:has-text("Update"), button:has-text("Delete"), button:has-text("Remove")');
    await expect(editBtn).not.toBeVisible();

    const inputFields = ownerPageA.locator('input[type="text"], textarea:not([disabled]), select:not([disabled])');
    await expect(inputFields).not.toBeVisible();
  });
});
