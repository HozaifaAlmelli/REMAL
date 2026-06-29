"use client";

import * as React from "react";
import { format, getDaysInMonth, subDays, addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useAvailabilityCheck,
  useUnitDateBlocks,
  useUnitSeasonalPricing,
} from "@/lib/hooks/useUnits";
import { cn } from "@/lib/utils/cn";

export interface AvailabilityCalendarProps {
  unitId: string;
  month: number;
  year: number;
  onMonthChange: (month: number, year: number) => void;
}

export function AvailabilityCalendar({
  unitId,
  month,
  year,
  onMonthChange,
}: AvailabilityCalendarProps) {
  const currentMonthDate = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDateStr = format(currentMonthDate, "yyyy-MM-dd");
  const endDateStr = format(lastDay, "yyyy-MM-dd");

  const { data: availability, isLoading: isLoadingAvail } =
    useAvailabilityCheck(unitId, month, year, {
      startDate: startDateStr,
      endDate: endDateStr,
    });

  const { isLoading: isLoadingBlocks } =
    useUnitDateBlocks(unitId);
  const { data: pricing = [], isLoading: isLoadingPricing } =
    useUnitSeasonalPricing(unitId);

  const handlePrevMonth = () => {
    const d = subDays(currentMonthDate, 1);
    onMonthChange(d.getMonth(), d.getFullYear());
  };

  const handleNextMonth = () => {
    const d = addDays(lastDay, 1);
    onMonthChange(d.getMonth(), d.getFullYear());
  };

  const daysInMonth = getDaysInMonth(currentMonthDate);
  // Weekday the 1st falls on (0 = Sunday) → number of blank cells before day 1.
  const startDayOfWeek = currentMonthDate.getDay();

  // Helper arrays for calendar grid
  const leadingEmptyDays = Array.from({ length: startDayOfWeek }).map(
    (_, i) => i
  );
  const daysArray = Array.from({ length: daysInMonth }).map((_, i) =>
    addDays(currentMonthDate, i)
  );

  // Extract unavailable dates from availability check
  const unavailableDates = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!availability) return map;
    if (!availability.isAvailable) {
      if (
        availability.blockedDates &&
        Array.isArray(availability.blockedDates)
      ) {
        availability.blockedDates.forEach((d) =>
          map.set(d, availability.reason)
        );
      }
    }
    return map;
  }, [availability]);

  const requestedDates = React.useMemo(() => {
    return new Set(availability?.heldDates ?? []);
  }, [availability?.heldDates]);

  // Check matching block or pricing for a day
  const getDayStatus = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
    const isUnavailable = unavailableDates.has(dateStr);
    const isRequested = requestedDates.has(dateStr);

    // Overlays
    const hasPricing = pricing.some(
      (p) => d >= new Date(p.startDate) && d <= new Date(p.endDate)
    );

    return {
      isUnavailable,
      isRequested,
      hasPricing,
      reason: unavailableDates.get(dateStr) || null,
    };
  };

  const isLoading = isLoadingAvail || isLoadingBlocks || isLoadingPricing;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-neutral-500">Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Month Nav */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-neutral-800">
          {format(currentMonthDate, "MMMM yyyy")}
        </h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px rounded-md border bg-neutral-200 text-center font-medium">
        {/* Days of week */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="bg-white py-2 text-xs text-neutral-500">
            {day}
          </div>
        ))}

        {/* Empty slots before day 1 */}
        {leadingEmptyDays.map((i) => (
          <div key={`empty-${i}`} className="min-h-[80px] bg-neutral-50" />
        ))}

        {/* Days */}
        {daysArray.map((day, i) => {
          const status = getDayStatus(day);
          return (
            <div
              key={i}
              title={status.reason || undefined}
              className={cn(
                "group relative flex min-h-[80px] flex-col items-center justify-start bg-white p-2 text-sm",
                status.isUnavailable &&
                  "border border-red-200 bg-red-50 !bg-opacity-50 text-red-900",
                !status.isUnavailable &&
                  status.isRequested &&
                  "border border-amber-200 bg-amber-50 text-amber-900",
                status.hasPricing && "border-2 border-amber-400" // Priority border overlay
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full font-medium"
                )}
              >
                {format(day, "d")}
              </span>
              {status.reason && (
                <span className="mt-1 line-clamp-2 px-1 text-[10px] leading-tight text-red-600">
                  {status.reason}
                </span>
              )}
              {!status.reason && status.isRequested && (
                <span className="mt-1 line-clamp-2 px-1 text-[10px] leading-tight text-amber-700">
                  requested hold
                </span>
              )}
              {/* Optional tooltip via group hover */}
              <div className="absolute bottom-full z-10 mb-2 hidden w-32 rounded bg-neutral-900 p-2 text-left text-xs text-white shadow-sm group-hover:block">
                {status.reason
                  ? `Unavailable: ${status.reason}`
                  : status.isRequested
                    ? "Requested by a storefront customer"
                    : "Available"}
                {status.hasPricing && (
                  <div className="mt-1 text-amber-300">
                    Has Seasonal Pricing
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <LegendDot className="bg-white ring-1 ring-neutral-300" label="Available" />
        <LegendDot className="bg-red-50 ring-1 ring-red-200" label="Blocked or booked" />
        <LegendDot className="bg-amber-50 ring-1 ring-amber-200" label="Requested hold" />
        <LegendDot className="bg-white ring-2 ring-amber-400" label="Seasonal pricing" />
      </div>
    </div>
  );
}

function LegendDot({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("h-3 w-3 rounded-[4px]", className)} />
      <span>{label}</span>
    </span>
  );
}
