import { test, expect } from "../fixtures/auth.fixture";
import {
  expectTwoDecimalCurrency,
  formatExpectedCurrency,
} from "../helpers/assertions";
import type { ApiEnvelope, OwnerFinanceSummary } from "../helpers/api.helpers";

test.describe("Owner Portal Finance Ledger", () => {
  test("Renders financial summary cards, decimal currency formatting, and read-only elements", async ({ ownerPageA }) => {
    const summaryResponsePromise = ownerPageA.waitForResponse(
      (response) =>
        response.url().includes("/api/owner/finance/summary") && response.ok()
    );

    await ownerPageA.goto("/owner/finance");
    const summaryResponse = await summaryResponsePromise;
    const summaryEnvelope =
      (await summaryResponse.json()) as ApiEnvelope<OwnerFinanceSummary>;
    const summary = summaryEnvelope.data;
    expect(summaryEnvelope.success).toBe(true);
    expect(summary).not.toBeNull();

    await expect(ownerPageA.locator("main h1")).toContainText(/Finance/i);

    const summaryHeader = ownerPageA.locator('h2:has-text("Financial Summary")');
    await expect(summaryHeader).toBeVisible({ timeout: 5000 });

    const getCardByLabel = (label: string) => ownerPageA.locator(`div:has(p:has-text("${label}"))`).last();

    const totalInvoicedCard = getCardByLabel("Total Invoiced Amount");
    const totalPaidCard = getCardByLabel("Total Paid Amount");
    const totalRemainingCard = getCardByLabel("Total Remaining Amount");
    const pendingPayoutCard = getCardByLabel("Total Pending Payout Amount");
    const scheduledPayoutCard = getCardByLabel("Total Scheduled Payout Amount");
    const paidPayoutCard = getCardByLabel("Total Paid Payout Amount");

    await expect(totalInvoicedCard).toBeVisible();
    await expect(totalPaidCard).toBeVisible();
    await expect(totalRemainingCard).toBeVisible();
    await expect(pendingPayoutCard).toBeVisible();
    await expect(scheduledPayoutCard).toBeVisible();
    await expect(paidPayoutCard).toBeVisible();

    await expect(totalInvoicedCard).toContainText(
      formatExpectedCurrency(summary!.totalInvoicedAmount)
    );
    await expect(totalPaidCard).toContainText(
      formatExpectedCurrency(summary!.totalPaidAmount)
    );
    await expect(totalRemainingCard).toContainText(
      formatExpectedCurrency(summary!.totalRemainingAmount)
    );
    await expect(pendingPayoutCard).toContainText(
      formatExpectedCurrency(summary!.totalPendingPayoutAmount)
    );
    await expect(scheduledPayoutCard).toContainText(
      formatExpectedCurrency(summary!.totalScheduledPayoutAmount)
    );
    await expect(paidPayoutCard).toContainText(
      formatExpectedCurrency(summary!.totalPaidPayoutAmount)
    );

    expectTwoDecimalCurrency(await totalInvoicedCard.innerText());
    expectTwoDecimalCurrency(await totalPaidCard.innerText());
    expectTwoDecimalCurrency(await totalRemainingCard.innerText());
    expectTwoDecimalCurrency(await pendingPayoutCard.innerText());
    expectTwoDecimalCurrency(await scheduledPayoutCard.innerText());
    expectTwoDecimalCurrency(await paidPayoutCard.innerText());

    const tableHeader = ownerPageA.locator('h2:has-text("Transaction History")');
    await expect(tableHeader).toBeVisible();

    const financeTable = ownerPageA.locator("table");
    await expect(financeTable).toBeVisible();

    const payoutActionBtn = ownerPageA.locator('button:has-text("Pay"), button:has-text("Payout"), button:has-text("Transfer"), button:has-text("Initiate")');
    await expect(payoutActionBtn).not.toBeVisible();
  });
});
