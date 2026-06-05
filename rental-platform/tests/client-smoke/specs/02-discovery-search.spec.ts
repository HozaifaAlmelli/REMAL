import { test, expect } from "../fixtures/auth.fixture";
import { getAdminApiToken } from "../helpers/api.helpers";
import { expectMoneyFormat, parseCurrencyText } from "../helpers/assertions";
import {
  cleanupClientSmokeData,
  createCleanupRegistry,
} from "../helpers/cleanup.helpers";
import { createSmokePublicUnit } from "../helpers/setup.helpers";
import { TEST_PREFIX } from "../fixtures/test-data";

test.describe.serial("Client discovery search and filters", () => {
  const registry = createCleanupRegistry();
  let adminToken = "";
  let groupPrefix = "";
  const createdUnits: Array<{ name: string; unitType: string; price: number }> = [];

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminApiToken(request);
    groupPrefix = `${TEST_PREFIX}Discovery_${Date.now()}`;

    const unitSpecs = [
      { unitType: "villa" as const, basePricePerNight: 9300 },
      { unitType: "chalet" as const, basePricePerNight: 9100 },
      { unitType: "studio" as const, basePricePerNight: 9200 },
    ];

    for (const spec of unitSpecs) {
      const setup = await createSmokePublicUnit(request, adminToken, registry, {
        namePrefix: groupPrefix,
        unitType: spec.unitType,
        basePricePerNight: spec.basePricePerNight,
      });
      createdUnits.push({
        name: setup.unit.name,
        unitType: spec.unitType,
        price: spec.basePricePerNight,
      });
    }
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupClientSmokeData(request, adminToken, registry);
  });

  test("filters generated units by lowercase unitType", async ({ page }) => {
    const chalet = createdUnits.find((unit) => unit.unitType === "chalet");
    const villa = createdUnits.find((unit) => unit.unitType === "villa");
    const studio = createdUnits.find((unit) => unit.unitType === "studio");
    expect(chalet).toBeTruthy();
    expect(villa).toBeTruthy();
    expect(studio).toBeTruthy();

    await page.goto(
      `/units?search=${encodeURIComponent(groupPrefix)}&unitType=chalet&minPrice=9000&maxPrice=9400`
    );

    await expect(page.getByRole("heading", { name: /explore properties/i })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(chalet!.name) })).toBeVisible();
    await expect(page.getByText(villa!.name)).toHaveCount(0);
    await expect(page.getByText(studio!.name)).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Chalet");
  });

  test("sorts isolated cards by ascending currency value", async ({ page }) => {
    await page.goto(
      `/units?search=${encodeURIComponent(groupPrefix)}&minPrice=9000&maxPrice=9400&sortBy=price_asc`
    );

    for (const unit of createdUnits) {
      await expect(page.getByText(unit.name)).toBeVisible();
    }

    const cardLinks = page.locator(`a:has-text("${groupPrefix}")`);
    const count = await cardLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);

    const prices: number[] = [];
    for (let index = 0; index < Math.min(count, 3); index++) {
      const text = await cardLinks.nth(index).innerText();
      const priceLine = text
        .split(/\r?\n/)
        .find((line) => /EGP/i.test(line));
      expect(priceLine).toBeTruthy();
      expectMoneyFormat(priceLine!);
      prices.push(parseCurrencyText(priceLine!));
    }

    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});
