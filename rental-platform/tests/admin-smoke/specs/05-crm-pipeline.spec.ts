import { test, expect } from "../fixtures/auth.fixture";

test.describe("CRM Pipeline & Leads Lifecycle", () => {
  test("Can create a CRM lead, view details, transition status, and handle notes", async ({ superAdminPage }) => {
    test.setTimeout(45000);

    // 1. Navigate to CRM page
    await superAdminPage.goto("/admin/crm");
    await expect(superAdminPage.locator("h1")).toHaveText(/CRM Pipeline/i);

    // 2. Click New Lead
    await superAdminPage.click('button:has-text("New Lead")');

    // Fill in lead details
    const leadName = `E2E_Lead_${Math.floor(Math.random() * 100000)}`;
    const leadPhone = `+201${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    
    await superAdminPage.getByLabel("Contact Name").fill(leadName);
    await superAdminPage.getByLabel("Phone").fill(leadPhone);
    await superAdminPage.getByLabel("Email (optional)").fill("e2e.smoke@example.com");
    
    // Select source option using the first select on page
    await superAdminPage.locator('select').first().selectOption("whatsapp");
    await superAdminPage.locator('textarea[name="notes"]').fill("Initial E2E Lead Notes");

    // Click submit inside modal
    await superAdminPage.click('button[type="submit"]');

    // 3. Confirm card appears in "New" column
    const leadCard = superAdminPage.locator(`[role="button"]:has-text("${leadName}")`).first();
    await expect(leadCard).toBeVisible({ timeout: 15000 });

    // 4. Click lead card to navigate to detail view
    await leadCard.click();
    await superAdminPage.waitForURL(/\/admin\/crm\/leads\/[a-f0-9-]/, { timeout: 15000 });

    // Verify detail page header and status
    await expect(superAdminPage.locator("h1")).toHaveText(leadName);
    await expect(superAdminPage.locator('span:has-text("New")').first()).toBeVisible();

    // 5. Add a CRM Note
    await superAdminPage.fill('textarea[placeholder*="Add a note"]', "E2E Followup call scheduled");
    await superAdminPage.locator('div:has(h3:has-text("Notes"))').locator('button:has-text("Add")').click();
    await expect(superAdminPage.locator('div:has-text("E2E Followup call scheduled")').first()).toBeVisible({ timeout: 10000 });

    // 6. Transition: New -> Contacted
    const contactedBtn = superAdminPage.locator('button:has-text("Contacted")').first();
    await expect(contactedBtn).toBeVisible({ timeout: 5000 });
    await contactedBtn.click();

    // Confirm transition dialog
    await superAdminPage.click('button:has-text("Confirm")');

    // Verify updated status badge
    await expect(superAdminPage.locator('span:has-text("Contacted")').first()).toBeVisible({ timeout: 10000 });
  });
});
