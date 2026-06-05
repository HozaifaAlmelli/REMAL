import { APIRequestContext } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  cancelPayment,
  deactivateArea,
  deactivateClient,
  deleteUnit,
  deleteUnitImage,
  getAreas,
  getClients,
  getInternalUnits,
  transitionBooking,
  updateLeadStatus,
} from "./api.helpers";
import { TEST_PREFIX } from "../fixtures/test-data";

const CLIENT_UPLOAD_PREFIXES = [
  TEST_PREFIX,
  "client-smoke-",
  "test-client-smoke-",
];

export interface CleanupRegistry {
  areaIds: string[];
  unitIds: string[];
  imageIds: Array<{ unitId: string; imageId: string }>;
  leadIds: string[];
  bookingIds: string[];
  paymentIds: string[];
  clientIds: string[];
  uploadFileKeys: string[];
}

export interface CleanupSummary {
  deactivatedAreas: string[];
  deactivatedClients: string[];
  deletedUnits: string[];
  deletedImages: string[];
  cancelledBookings: string[];
  lostLeads: string[];
  cancelledPayments: string[];
  deletedUploads: string[];
  failures: string[];
}

export function createCleanupRegistry(): CleanupRegistry {
  return {
    areaIds: [],
    unitIds: [],
    imageIds: [],
    leadIds: [],
    bookingIds: [],
    paymentIds: [],
    clientIds: [],
    uploadFileKeys: [],
  };
}

function emptySummary(): CleanupSummary {
  return {
    deactivatedAreas: [],
    deactivatedClients: [],
    deletedUnits: [],
    deletedImages: [],
    cancelledBookings: [],
    lostLeads: [],
    cancelledPayments: [],
    deletedUploads: [],
    failures: [],
  };
}

export function isClientSmokeName(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(TEST_PREFIX);
}

function isClientSmokeUpload(value: string): boolean {
  return CLIENT_UPLOAD_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function createClientSmokeUpload(fileName: string): string {
  if (!isClientSmokeUpload(fileName)) {
    throw new Error(`Refused to create non-client-smoke upload: ${fileName}`);
  }

  const uploadsDir = path.resolve(process.cwd(), "../uploads");
  const workspaceRoot = path.resolve(process.cwd(), "..");

  if (!uploadsDir.startsWith(workspaceRoot)) {
    throw new Error(`Refused to write upload outside workspace: ${uploadsDir}`);
  }

  fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(
    filePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lT0V4QAAAABJRU5ErkJggg==",
      "base64"
    )
  );
  return fileName;
}

export async function cleanupClientSmokeData(
  request: APIRequestContext,
  adminToken: string,
  registry = createCleanupRegistry()
): Promise<CleanupSummary> {
  const summary = emptySummary();

  for (const paymentId of [...new Set(registry.paymentIds)]) {
    try {
      if (await cancelPayment(request, adminToken, paymentId)) {
        summary.cancelledPayments.push(paymentId);
      }
    } catch (error) {
      summary.failures.push(`Payment cleanup failed for ${paymentId}: ${(error as Error).message}`);
    }
  }

  for (const bookingId of [...new Set(registry.bookingIds)]) {
    try {
      if (await transitionBooking(request, adminToken, bookingId, "cancel")) {
        summary.cancelledBookings.push(bookingId);
      }
    } catch (error) {
      summary.failures.push(`Booking cleanup failed for ${bookingId}: ${(error as Error).message}`);
    }
  }

  for (const leadId of [...new Set(registry.leadIds)]) {
    try {
      if (await updateLeadStatus(request, adminToken, leadId, "Lost")) {
        summary.lostLeads.push(leadId);
      }
    } catch (error) {
      summary.failures.push(`Lead cleanup failed for ${leadId}: ${(error as Error).message}`);
    }
  }

  for (const image of registry.imageIds) {
    try {
      if (await deleteUnitImage(request, adminToken, image.unitId, image.imageId)) {
        summary.deletedImages.push(image.imageId);
      }
    } catch (error) {
      summary.failures.push(`Image cleanup failed for ${image.imageId}: ${(error as Error).message}`);
    }
  }

  try {
    const units = await getInternalUnits(request, adminToken);
    const unitIds = new Set(registry.unitIds);
    for (const unit of units) {
      const name = unit.name ?? unit.unitName ?? "";
      if (isClientSmokeName(name)) unitIds.add(unit.id);
    }

    for (const unitId of unitIds) {
      if (await deleteUnit(request, adminToken, unitId)) {
        summary.deletedUnits.push(unitId);
      }
    }
  } catch (error) {
    summary.failures.push(`Unit cleanup failed: ${(error as Error).message}`);
  }

  try {
    const areas = await getAreas(request, adminToken);
    const areaIds = new Set(registry.areaIds);
    for (const area of areas) {
      if (isClientSmokeName(area.name) && area.isActive !== false) {
        areaIds.add(area.id);
      }
    }

    for (const areaId of areaIds) {
      if (await deactivateArea(request, adminToken, areaId)) {
        summary.deactivatedAreas.push(areaId);
      }
    }
  } catch (error) {
    summary.failures.push(`Area cleanup failed: ${(error as Error).message}`);
  }

  try {
    const clients = await getClients(request, adminToken, TEST_PREFIX);
    const clientIds = new Set(registry.clientIds);
    for (const client of clients.items) {
      if (isClientSmokeName(client.name) && client.isActive !== false) {
        clientIds.add(client.id);
      }
    }

    for (const clientId of clientIds) {
      if (await deactivateClient(request, adminToken, clientId)) {
        summary.deactivatedClients.push(clientId);
      }
    }
  } catch (error) {
    summary.failures.push(`Client cleanup failed: ${(error as Error).message}`);
  }

  cleanupClientSmokeUploads(registry.uploadFileKeys, summary);

  return summary;
}

function cleanupClientSmokeUploads(
  fileKeys: string[],
  summary: CleanupSummary
): void {
  const uploadsDir = path.resolve(process.cwd(), "../uploads");
  const workspaceRoot = path.resolve(process.cwd(), "..");

  if (!uploadsDir.startsWith(workspaceRoot)) {
    summary.failures.push(`Refused to scan uploads outside workspace: ${uploadsDir}`);
    return;
  }

  if (!fs.existsSync(uploadsDir)) return;

  const requested = new Set(fileKeys.map((fileKey) => path.basename(fileKey)));
  for (const entry of fs.readdirSync(uploadsDir)) {
    if (!isClientSmokeUpload(entry) && !requested.has(entry)) continue;
    if (!isClientSmokeUpload(entry)) continue;

    const entryPath = path.join(uploadsDir, entry);
    const stat = fs.statSync(entryPath);
    if (!stat.isFile()) continue;

    try {
      fs.unlinkSync(entryPath);
      summary.deletedUploads.push(entryPath);
    } catch (error) {
      summary.failures.push(
        `Upload cleanup failed for ${entryPath}: ${(error as Error).message}`
      );
    }
  }
}
