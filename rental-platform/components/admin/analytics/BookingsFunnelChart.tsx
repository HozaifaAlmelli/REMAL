"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import type { BookingAnalyticsSummaryResponse } from "@/lib/types/report.types";
import { getOperationalFunnel } from "@/lib/historical-reporting/presentation";

interface BookingsFunnelChartProps {
  data: BookingAnalyticsSummaryResponse | undefined;
  isLoading: boolean;
}

export function BookingsFunnelChart({
  data,
  isLoading,
}: BookingsFunnelChartProps) {
  if (isLoading) {
    return <Skeleton height={280} className="rounded-lg" />;
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-medium text-neutral-700">Bookings Funnel</h3>
        <p className="text-sm italic text-neutral-400">
          Funnel data unavailable
        </p>
      </div>
    );
  }

  const operational = getOperationalFunnel(data);
  const funnelSteps = [
    {
      label: "Created",
      value: operational.created,
      color: "var(--color-primary-500)",
    },
    {
      label: "Prospecting",
      value: operational.prospecting,
      color: "var(--color-accent-amber)",
    },
    {
      label: "Confirmed",
      value: operational.confirmed,
      color: "var(--color-primary-300)",
    },
    {
      label: "Completed",
      value: operational.completed,
      color: "var(--color-accent-green)",
    },
    {
      label: "Cancelled",
      value: operational.cancelled,
      color: "var(--color-error)",
    },
  ];

  const maxValue = Math.max(...funnelSteps.map((s) => s.value), 1);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-medium text-neutral-700">Bookings Funnel</h3>
      <p className="mb-4 text-xs leading-relaxed text-neutral-500">
        Operational acquisition and conversion only. Historical records entered: {operational.historicalExcluded}; not included in this funnel.
      </p>
      <div className="space-y-3">
        {funnelSteps.map((step) => (
          <div key={step.label} className="flex items-center gap-3">
            <span className="w-24 text-right text-sm text-neutral-600">
              {step.label}
            </span>
            <div className="h-8 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="flex h-full items-center rounded-full pl-3 transition-all duration-500"
                style={{
                  width: `${(step.value / maxValue) * 100}%`,
                  backgroundColor: step.color,
                  minWidth: step.value > 0 ? "2rem" : "0",
                }}
              >
                <span className="text-xs font-medium text-white">
                  {step.value > 0 ? step.value : ""}
                </span>
              </div>
            </div>
            <span className="w-12 text-sm font-medium text-neutral-800">
              {step.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
