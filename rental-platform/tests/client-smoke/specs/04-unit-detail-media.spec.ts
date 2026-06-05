import { test, expect } from "../fixtures/auth.fixture";
import {
  getAdminApiToken,
  getPublicReviewSummary,
  getPublicUnit,
  getUnitImages,
} from "../helpers/api.helpers";
import { expectNoPii, formatExpectedCurrency } from "../helpers/assertions";
import {
  cleanupClientSmokeData,
  createCleanupRegistry,
} from "../helpers/cleanup.helpers";
import { createSmokePublicUnit } from "../helpers/setup.helpers";
import { TEST_PREFIX } from "../fixtures/test-data";

test.describe.serial("Client unit detail media and contract mapping", () => {
  const registry = createCleanupRegistry();
  let adminToken = "";
  let unitId = "";

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminApiToken(request);
    const setup = await createSmokePublicUnit(request, adminToken, registry, {
      namePrefix: `${TEST_PREFIX}Detail`,
      unitType: "villa",
      basePricePerNight: 2450,
      maxGuests: 7,
    });
    unitId = setup.unit.id;
  });

  test.afterAll(async ({ request }) => {
    if (adminToken) await cleanupClientSmokeData(request, adminToken, registry);
  });

  test("renders detail fields, gallery fileKey image, and review summary safely", async ({
    page,
    request,
  }) => {
    const [unit, images, summary] = await Promise.all([
      getPublicUnit(request, unitId),
      getUnitImages(request, unitId),
      getPublicReviewSummary(request, unitId),
    ]);

    expect(images.length).toBeGreaterThan(0);
    expect(images[0]?.fileKey).toBeTruthy();

    await page.goto(`/units/${unitId}`);
    await expect(page.getByRole("heading", { name: unit.name })).toBeVisible();
    await expect(page.locator("body")).toContainText(/villa/i);
    await expect(page.locator("body")).toContainText(`${unit.maxGuests}`);
    await expect(page.locator("body")).toContainText(
      formatExpectedCurrency(unit.basePricePerNight)
    );

    const image = page.locator(`img[alt*="${unit.name}"]`).first();
    await expect(image).toBeVisible();
    const imageSrc = await image.getAttribute("src");
    expect(imageSrc).toBeTruthy();
    expect(imageSrc!).toContain(images[0]!.fileKey);

    await expect(page.getByText(/guest reviews/i)).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    if (summary.publishedReviewCount === 0) {
      await expect(page.locator("bdi").first()).toBeVisible();
    } else {
      expect(bodyText).toContain(summary.averageRating.toFixed(1));
      expect(bodyText).toContain(`${summary.publishedReviewCount}`);
    }

    expectNoPii(summary, "public review summary");
  });
});
