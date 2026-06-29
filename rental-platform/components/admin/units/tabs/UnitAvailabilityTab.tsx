"use client";

import * as React from "react";
import { AvailabilityCalendar } from "../AvailabilityCalendar";

export interface UnitAvailabilityTabProps {
  unitId: string;
}

export function UnitAvailabilityTab({ unitId }: UnitAvailabilityTabProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const handleMonthChange = (month: number, year: number) => {
    setCurrentDate(new Date(year, month, 1));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-800">
          Unit Availability
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          View operational availability and seasonal pricing coverage for this
          unit.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <AvailabilityCalendar
          unitId={unitId}
          month={currentDate.getMonth()}
          year={currentDate.getFullYear()}
          onMonthChange={handleMonthChange}
        />
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-neutral-200 bg-white"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-red-200 bg-red-50"></div>
          <span>Unavailable / Blocked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-amber-200 bg-amber-50"></div>
          <span>Requested hold</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border-2 border-amber-400 bg-white"></div>
          <span>Seasonal Pricing</span>
        </div>
      </div>
    </div>
  );
}
