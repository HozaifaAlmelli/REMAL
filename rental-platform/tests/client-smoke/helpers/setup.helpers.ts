import { APIRequestContext } from "@playwright/test";
import { OWNER_USERS, TEST_PREFIX } from "../fixtures/test-data";
import {
  addUnitImage,
  createTestArea,
  createTestUnit,
  PublicUnitDetail,
  UnitImageResponse,
  uniqueRunId,
} from "./api.helpers";
import {
  CleanupRegistry,
  createClientSmokeUpload,
} from "./cleanup.helpers";

export interface SmokeUnitSetup {
  runId: string;
  areaId: string;
  unit: PublicUnitDetail;
  image: UnitImageResponse;
  fileKey: string;
}

export async function createSmokePublicUnit(
  request: APIRequestContext,
  adminToken: string,
  registry: CleanupRegistry,
  options?: {
    namePrefix?: string;
    unitType?: "villa" | "chalet" | "studio";
    basePricePerNight?: number;
    maxGuests?: number;
  }
): Promise<SmokeUnitSetup> {
  const runId = uniqueRunId();
  const area = await createTestArea(
    request,
    adminToken,
    `${TEST_PREFIX}Area_${runId}`
  );
  registry.areaIds.push(area.id);

  const unit = await createTestUnit<PublicUnitDetail>(request, adminToken, {
    ownerId: OWNER_USERS.OwnerA.id,
    areaId: area.id,
    name: `${options?.namePrefix ?? `${TEST_PREFIX}Unit`}_${runId}`,
    description: "Client smoke generated public unit",
    address: "North Coast Smoke Test",
    unitType: options?.unitType ?? "chalet",
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: options?.maxGuests ?? 6,
    basePricePerNight: options?.basePricePerNight ?? 1250,
    isActive: true,
  });
  registry.unitIds.push(unit.id);

  const fileKey = createClientSmokeUpload(`client-smoke-${runId}.png`);
  registry.uploadFileKeys.push(fileKey);

  const image = await addUnitImage(request, adminToken, unit.id, fileKey);
  registry.imageIds.push({ unitId: unit.id, imageId: image.id });

  return { runId, areaId: area.id, unit, image, fileKey };
}
