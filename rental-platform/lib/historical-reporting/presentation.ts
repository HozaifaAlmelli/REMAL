import type {
  BookingAnalyticsSummaryResponse,
  HistoricalScope,
} from "@/lib/types/report.types";

export const HISTORICAL_SCOPE_OPTIONS: ReadonlyArray<{
  value: HistoricalScope;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "ordinary", label: "Ordinary" },
  { value: "historical", label: "Historical" },
];

export function historicalScopeToQuery(scope: HistoricalScope) {
  if (scope === "ordinary") {
    return { includeHistorical: false, historicalOnly: false };
  }
  if (scope === "historical") {
    return { includeHistorical: true, historicalOnly: true };
  }
  return { includeHistorical: true, historicalOnly: false };
}

export function historicalScopeToBookingFilter(scope: HistoricalScope) {
  if (scope === "ordinary") return false;
  if (scope === "historical") return true;
  return undefined;
}

export function getOperationalFunnel(
  summary: BookingAnalyticsSummaryResponse
) {
  const historical = summary.historicalBookingsCount;
  return {
    historicalExcluded: historical,
    created: Math.max(0, summary.totalBookingsCreatedCount - historical),
    prospecting: summary.totalProspectingBookingsCount,
    confirmed: summary.totalConfirmedBookingsCount,
    completed: Math.max(0, summary.totalCompletedBookingsCount - historical),
    cancelled: summary.totalCancelledBookingsCount,
  };
}

const PROVENANCE_LABELS: Readonly<Record<string, string>> = {
  legacy_system: "Legacy system",
  external_platform: "External platform",
  offline_record: "Offline record",
  other: "Other",
};

export function formatHistoricalProvenance(value: string | null | undefined) {
  if (!value) return "Other";
  return PROVENANCE_LABELS[value] ?? "Other";
}

const ENTRY_REASON_LABELS: Readonly<Record<string, string>> = {
  offline_booking_recorded_after_stay: "Offline booking recorded after stay",
  external_platform_import: "External platform import",
  late_operational_entry: "Late operational entry",
  accounting_reconciliation: "Accounting reconciliation",
  other: "Other",
};

export function formatHistoricalEntryReason(value: string | null | undefined) {
  if (!value) return "Not provided";
  return ENTRY_REASON_LABELS[value] ?? "Other";
}
