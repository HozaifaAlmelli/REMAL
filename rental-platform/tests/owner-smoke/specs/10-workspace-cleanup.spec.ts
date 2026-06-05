import { test, expect } from "@playwright/test";
import {
  getAdminApiToken,
  getAreas,
  getInternalUnits,
} from "../helpers/api.helpers";
import {
  cleanupOwnerSmokeData,
  isOwnerSmokeName,
} from "../helpers/cleanup.helpers";

type UnitListItem = {
  id: string;
  name?: string;
  unitName?: string;
};

type AreaListItem = {
  id: string;
  name: string;
  isActive: boolean;
};

test.describe("Project Workspace & Database Sanitization", () => {
  test("Runs safe cleanup for owner-smoke records and whitelisted uploads only", async ({
    request,
  }) => {
    test.setTimeout(45_000);

    const adminToken = await getAdminApiToken(request);
    const summary = await cleanupOwnerSmokeData(request, adminToken);

    expect(
      summary.failures,
      `Cleanup failures:\n${summary.failures.join("\n")}`
    ).toEqual([]);

    const remainingUnits = await getInternalUnits<UnitListItem>(
      request,
      adminToken,
      {
        page: 1,
        pageSize: 500,
        includeInactive: true,
      }
    );
    const activeSmokeUnits = remainingUnits.filter((unit) =>
      isOwnerSmokeName(unit.name ?? unit.unitName)
    );
    expect(activeSmokeUnits).toEqual([]);

    const publicAreas = await getAreas<AreaListItem>(request, adminToken, false);
    const publicSmokeAreas = publicAreas.filter((area) =>
      isOwnerSmokeName(area.name)
    );
    expect(publicSmokeAreas).toEqual([]);
  });
});

