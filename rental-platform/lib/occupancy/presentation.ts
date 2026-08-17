import type {
  OccupancyAnalyticsResponse,
  OccupancyUnavailableReason,
} from "@/lib/types/report.types";

const cairoDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const unavailableMessages: Record<OccupancyUnavailableReason, string> = {
  coverage_incomplete: "Capacity history is unavailable for this period.",
  zero_capacity: "No rentable capacity is available for this period.",
  integrity_conflict: "Occupancy data needs review before a rate can be shown.",
};

export function getCurrentMonthOccupancyRange(now = new Date()): {
  from: string;
  toExclusive: string;
} {
  const parts = Object.fromEntries(
    cairoDateFormatter
      .formatToParts(now)
      .filter(
        ({ type }) => type === "year" || type === "month" || type === "day"
      )
      .map(({ type, value }) => [type, value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const toExclusive = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);

  return {
    from: `${parts.year}-${parts.month}-01`,
    toExclusive,
  };
}

export function getOccupancyPresentation(
  result: OccupancyAnalyticsResponse
):
  | { kind: "rate"; valueLabel: string; rate: number }
  | { kind: "unavailable"; valueLabel: "N/A"; message: string } {
  if (result.occupancyRate === null) {
    const reason = result.unavailableReason ?? "coverage_incomplete";
    return {
      kind: "unavailable",
      valueLabel: "N/A",
      message: unavailableMessages[reason],
    };
  }

  return {
    kind: "rate",
    valueLabel: `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(result.occupancyRate)}%`,
    rate: result.occupancyRate,
  };
}
