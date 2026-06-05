import { test, expect } from "../fixtures/auth.fixture";
import {
  getAdminApiToken,
  getAreas,
  getClients,
  getPublicUnits,
} from "../helpers/api.helpers";
import { cleanupClientSmokeData } from "../helpers/cleanup.helpers";
import { TEST_PREFIX } from "../fixtures/test-data";

test.describe("Client smoke safe cleanup verification", () => {
  test("removes or deactivates generated client-smoke records only", async ({
    request,
  }) => {
    const adminToken = await getAdminApiToken(request);
    const summary = await cleanupClientSmokeData(request, adminToken);
    expect(summary.failures).toEqual([]);

    const publicUnits = await getPublicUnits(request, {
      search: TEST_PREFIX,
      page: 1,
      pageSize: 100,
    });
    expect(publicUnits.items.filter((unit) => unit.name.startsWith(TEST_PREFIX))).toEqual([]);

    const areas = await getAreas(request, adminToken);
    expect(
      areas.filter((area) => area.name.startsWith(TEST_PREFIX) && area.isActive)
    ).toEqual([]);

    const clients = await getClients(request, adminToken, TEST_PREFIX);
    expect(
      clients.items.filter(
        (client) => client.name.startsWith(TEST_PREFIX) && client.isActive
      )
    ).toEqual([]);
  });
});
