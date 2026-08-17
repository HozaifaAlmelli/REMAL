"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import type { BookingAnalyticsDailySummaryResponse } from "@/lib/types/report.types";

interface DailyBookingsTableProps {
  data: BookingAnalyticsDailySummaryResponse[];
  isLoading: boolean;
}

export function DailyBookingsTable({
  data,
  isLoading,
}: DailyBookingsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Daily booking data is not available"
        description="No bookings data for the selected period."
      />
    );
  }

  // Compute totals
  const totals = data.reduce(
    (acc, row) => ({
      bookingsCreatedCount: acc.bookingsCreatedCount + row.bookingsCreatedCount,
      prospectingBookingsCount:
        acc.prospectingBookingsCount + row.prospectingBookingsCount,
      confirmedBookingsCount:
        acc.confirmedBookingsCount + row.confirmedBookingsCount,
      cancelledBookingsCount:
        acc.cancelledBookingsCount + row.cancelledBookingsCount,
      completedBookingsCount:
        acc.completedBookingsCount + row.completedBookingsCount,
      totalFinalAmount: acc.totalFinalAmount + row.totalFinalAmount,
      historicalBookingsCount:
        acc.historicalBookingsCount + row.historicalBookingsCount,
      historicalAgreedAmount:
        acc.historicalAgreedAmount + row.historicalAgreedAmount,
    }),
    {
      bookingsCreatedCount: 0,
      prospectingBookingsCount: 0,
      confirmedBookingsCount: 0,
      cancelledBookingsCount: 0,
      completedBookingsCount: 0,
      totalFinalAmount: 0,
      historicalBookingsCount: 0,
      historicalAgreedAmount: 0,
    }
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-neutral-500">
            <th className="p-3">Recorded date</th>
            <th className="p-3">Source</th>
            <th className="p-3">Created</th>
            <th className="p-3">Historical</th>
            <th className="p-3">Prospecting</th>
            <th className="p-3">Confirmed</th>
            <th className="p-3">Completed</th>
            <th className="p-3">Cancelled</th>
            <th className="p-3">Total Value</th>
            <th className="p-3">Historical agreed</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={`${row.metricDate}-${idx}`}
              className="border-b hover:bg-neutral-50"
            >
              <td className="p-3 text-sm">{formatDate(row.metricDate)}</td>
              <td className="p-3 text-sm">
                {BOOKING_SOURCE_LABELS[
                  row.bookingSource as keyof typeof BOOKING_SOURCE_LABELS
                ] ?? row.bookingSource}
              </td>
              <td className="p-3 text-sm">{row.bookingsCreatedCount}</td>
              <td className="p-3 text-sm font-medium text-amber-800">
                {row.historicalBookingsCount}
              </td>
              <td className="p-3 text-sm">{row.prospectingBookingsCount}</td>
              <td className="p-3 text-sm">{row.confirmedBookingsCount}</td>
              <td className="p-3 text-sm">{row.completedBookingsCount}</td>
              <td className="p-3 text-sm">{row.cancelledBookingsCount}</td>
              <td className="p-3 text-sm">
                {formatCurrency(row.totalFinalAmount)}
              </td>
              <td className="p-3 text-sm text-amber-800">
                {formatCurrency(row.historicalAgreedAmount)}
              </td>
            </tr>
          ))}
          {/* Totals row */}
          <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
            <td className="p-3 text-sm">Total</td>
            <td className="p-3 text-sm">—</td>
            <td className="p-3 text-sm">{totals.bookingsCreatedCount}</td>
            <td className="p-3 text-sm">{totals.historicalBookingsCount}</td>
            <td className="p-3 text-sm">{totals.prospectingBookingsCount}</td>
            <td className="p-3 text-sm">{totals.confirmedBookingsCount}</td>
            <td className="p-3 text-sm">{totals.completedBookingsCount}</td>
            <td className="p-3 text-sm">{totals.cancelledBookingsCount}</td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.totalFinalAmount)}
            </td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.historicalAgreedAmount)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
