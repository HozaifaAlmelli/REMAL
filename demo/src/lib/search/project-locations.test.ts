import test from "node:test";
import assert from "node:assert/strict";
import type { UnitListItem } from "@/lib/api/types";
import { buildUnitMapPoints, getProjectLocation } from "./project-locations";

function unit(overrides: Partial<UnitListItem>): UnitListItem {
  return {
    id: "unit-1",
    ownerId: "owner-1",
    ownerName: "Owner",
    projectId: "project-1",
    projectName: "Abraj Al Alamein",
    name: "Sea View",
    unitType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    basePricePerNight: 4000,
    isActive: true,
    createdAt: "2026-07-01T00:00:00Z",
    images: [],
    ...overrides,
  };
}

test("resolves English and Arabic project aliases", () => {
  assert.deepEqual(
    getProjectLocation("Abraj Al Alamein"),
    getProjectLocation("أبراج العلمين")
  );
});

test("creates one point per eligible result and safely skips unknown projects", () => {
  const points = buildUnitMapPoints([
    unit({ id: "unit-1" }),
    unit({ id: "unit-2" }),
    unit({
      id: "unit-without-location",
      projectId: "unknown-project",
      projectName: "Unknown Project",
    }),
  ]);

  assert.equal(points.length, 2);
  assert.deepEqual(points.map((point) => point.unit.id).sort(), ["unit-1", "unit-2"]);
  assert.ok(points.every((point) => Number.isFinite(point.latitude)));
  assert.ok(points.every((point) => Number.isFinite(point.longitude)));
});

test("handles one-marker and zero-marker result sets", () => {
  const onePoint = buildUnitMapPoints([unit({ id: "single" })]);
  const noPoints = buildUnitMapPoints([
    unit({ projectId: "unknown", projectName: "Unknown Project" }),
  ]);

  assert.equal(onePoint.length, 1);
  assert.deepEqual(noPoints, []);
});
