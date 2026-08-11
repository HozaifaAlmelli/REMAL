import assert from "node:assert/strict";
import test from "node:test";

import {
  formatHistoricalEntryReason,
  formatHistoricalProvenance,
  getOperationalFunnel,
  historicalScopeToBookingFilter,
  historicalScopeToQuery,
} from "./presentation";

test("Historical scopes preserve independent server filter semantics", () => {
  assert.deepEqual(historicalScopeToQuery("all"), {
    includeHistorical: true,
    historicalOnly: false,
  });
  assert.deepEqual(historicalScopeToQuery("ordinary"), {
    includeHistorical: false,
    historicalOnly: false,
  });
  assert.deepEqual(historicalScopeToQuery("historical"), {
    includeHistorical: true,
    historicalOnly: true,
  });
  assert.equal(historicalScopeToBookingFilter("all"), undefined);
  assert.equal(historicalScopeToBookingFilter("ordinary"), false);
  assert.equal(historicalScopeToBookingFilter("historical"), true);
});

test("operational funnel excludes Historical records without double counting", () => {
  const result = getOperationalFunnel({
    dateFrom: null,
    dateTo: null,
    bookingSource: null,
    totalBookingsCreatedCount: 12,
    totalProspectingBookingsCount: 4,
    totalConfirmedBookingsCount: 3,
    totalCancelledBookingsCount: 2,
    totalCompletedBookingsCount: 5,
    totalFinalAmount: 30_000,
    historicalBookingsCount: 2,
    historicalAgreedAmount: 7_000,
    historicalLegacySystemBookingsCount: 1,
    historicalExternalPlatformBookingsCount: 0,
    historicalOfflineRecordBookingsCount: 1,
    historicalOtherSourceBookingsCount: 0,
  });

  assert.deepEqual(result, {
    historicalExcluded: 2,
    created: 10,
    prospecting: 4,
    confirmed: 3,
    completed: 3,
    cancelled: 2,
  });
});

test("Historical provenance and reasons use bounded human labels", () => {
  assert.equal(formatHistoricalProvenance("legacy_system"), "Legacy system");
  assert.equal(formatHistoricalProvenance("external_platform"), "External platform");
  assert.equal(formatHistoricalProvenance("offline_record"), "Offline record");
  assert.equal(formatHistoricalProvenance("future_source"), "Other");
  assert.equal(formatHistoricalProvenance(null), "Other");
  assert.equal(
    formatHistoricalEntryReason("offline_booking_recorded_after_stay"),
    "Offline booking recorded after stay"
  );
  assert.equal(formatHistoricalEntryReason("future_reason"), "Other");
});
