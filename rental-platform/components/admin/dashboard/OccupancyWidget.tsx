"use client";

import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useReports } from "@/lib/hooks/useReports";
import {
  getCurrentMonthOccupancyRange,
  getOccupancyPresentation,
} from "@/lib/occupancy/presentation";

export function OccupancyWidget() {
  const { canViewReports } = usePermissions();
  const { useOccupancy } = useReports();
  const range = getCurrentMonthOccupancyRange();
  const { data, isLoading, isError } = useOccupancy(range, {
    enabled: canViewReports,
  });

  if (!canViewReports) return null;

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading occupancy"
        data-testid="occupancy-loading"
      >
        <Skeleton height={260} className="rounded-[4px]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <section
        role="alert"
        aria-labelledby="occupancy-error-heading"
        className="min-h-[260px] rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white p-5"
      >
        <h3
          id="occupancy-error-heading"
          className="mb-1 text-[13px] font-semibold text-neutral-900"
        >
          Occupancy rate
        </h3>
        <p className="mb-8 text-xs text-neutral-500">Current month to date</p>
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertCircle aria-hidden="true" size={24} className="text-error" />
          <p className="text-sm font-medium text-neutral-800">
            Couldn&apos;t load occupancy
          </p>
          <p className="max-w-56 text-xs text-neutral-500">
            Check your connection and try again.
          </p>
        </div>
      </section>
    );
  }

  const presentation = getOccupancyPresentation(data);
  const threshold =
    presentation.kind === "rate"
      ? presentation.rate >= 70
        ? { color: "var(--color-accent-green)", label: "High" }
        : presentation.rate >= 40
          ? { color: "var(--color-accent-amber)", label: "Medium" }
          : { color: "var(--color-error)", label: "Low" }
      : { color: "var(--color-neutral-400)", label: "Unavailable" };

  return (
    <section
      aria-labelledby="occupancy-heading"
      className="min-h-[260px] rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white p-5"
    >
      <h3
        id="occupancy-heading"
        className="mb-1 text-[13px] font-semibold text-neutral-900"
      >
        Occupancy rate
      </h3>
      <p className="mb-4 text-xs text-neutral-500">Current month to date</p>

      <div className="flex items-center justify-center">
        <div
          role="img"
          aria-label={
            presentation.kind === "rate"
              ? `Occupancy rate ${presentation.valueLabel}`
              : `Occupancy rate unavailable. ${presentation.message}`
          }
          className="relative h-32 w-32"
        >
          <svg
            aria-hidden="true"
            className="h-full w-full -rotate-90 transform"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              pathLength="100"
              fill="none"
              stroke="var(--color-neutral-100)"
              strokeWidth="8"
            />
            {presentation.kind === "rate" && (
              <circle
                cx="50"
                cy="50"
                r="42"
                pathLength="100"
                fill="none"
                stroke={threshold.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${presentation.rate} 100`}
                className="transition-all duration-500 motion-reduce:transition-none"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              data-testid="occupancy-value"
              className="text-3xl font-bold tabular-nums"
              style={{ color: threshold.color }}
            >
              {presentation.valueLabel}
            </span>
            <span className="text-xs text-neutral-500">{threshold.label}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-8 text-center text-xs text-neutral-500">
        {presentation.kind === "rate" && data.availableUnitNights !== null ? (
          <p>
            {data.occupiedUnitNights} occupied unit-nights /{" "}
            {data.availableUnitNights} available unit-nights
          </p>
        ) : (
          <p>{presentation.kind === "unavailable" && presentation.message}</p>
        )}
      </div>
    </section>
  );
}
