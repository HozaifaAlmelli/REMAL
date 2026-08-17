import assert from "node:assert/strict";
import test from "node:test";

import type { OccupancyAnalyticsResponse } from "../types/report.types";
import {
  getCurrentMonthOccupancyRange,
  getOccupancyPresentation,
} from "./presentation";

function result(
  occupancyRate: number | null,
  unavailableReason: OccupancyAnalyticsResponse["unavailableReason"] = null
): OccupancyAnalyticsResponse {
  return {
    from: "2026-08-01",
    toExclusive: "2026-08-16",
    occupiedUnitNights: 1,
    availableUnitNights: occupancyRate === null ? null : 10,
    occupancyRate,
    availabilityCoverageComplete: unavailableReason !== "coverage_incomplete",
    coverageStartDate: "2026-08-01",
    unavailableReason,
  };
}

test("current Cairo month maps to a half-open month-to-date range", () => {
  assert.deepEqual(
    getCurrentMonthOccupancyRange(new Date("2026-08-14T21:30:00.000Z")),
    { from: "2026-08-01", toExclusive: "2026-08-16" }
  );
  assert.deepEqual(
    getCurrentMonthOccupancyRange(new Date("2026-08-31T21:30:00.000Z")),
    { from: "2026-09-01", toExclusive: "2026-09-02" }
  );
});

test("backend rates are formatted without deriving or clamping occupancy", () => {
  assert.deepEqual(getOccupancyPresentation(result(10)), {
    kind: "rate",
    valueLabel: "10%",
    rate: 10,
  });
  assert.deepEqual(getOccupancyPresentation(result(50)), {
    kind: "rate",
    valueLabel: "50%",
    rate: 50,
  });
  assert.deepEqual(getOccupancyPresentation(result(125)), {
    kind: "rate",
    valueLabel: "125%",
    rate: 125,
  });
});

test("every unavailable reason renders N/A rather than a percentage", () => {
  assert.deepEqual(
    getOccupancyPresentation(result(null, "coverage_incomplete")),
    {
      kind: "unavailable",
      valueLabel: "N/A",
      message: "Capacity history is unavailable for this period.",
    }
  );
  assert.deepEqual(getOccupancyPresentation(result(null, "zero_capacity")), {
    kind: "unavailable",
    valueLabel: "N/A",
    message: "No rentable capacity is available for this period.",
  });
  assert.deepEqual(
    getOccupancyPresentation(result(null, "integrity_conflict")),
    {
      kind: "unavailable",
      valueLabel: "N/A",
      message: "Occupancy data needs review before a rate can be shown.",
    }
  );
});
