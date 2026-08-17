"use client";

import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import type { BookingAnalyticsDailySummaryResponse } from "@/lib/types/finance.types";

interface BookingsAnalyticsTableProps {
  data: BookingAnalyticsDailySummaryResponse[];
  isLoading: boolean;
}

export function BookingsAnalyticsTable({
  data,
  isLoading,
}: BookingsAnalyticsTableProps) {
  if (isLoading) {
    return <SkeletonTable rows={10} columns={8} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Booking rows are not available"
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
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[1120px] border-collapse">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <th className="px-4 py-3">Recorded date</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 text-right">Created</th>
            <th className="px-4 py-3 text-right">Historical</th>
            <th className="px-4 py-3 text-right">Prospecting</th>
            <th className="px-4 py-3 text-right">Confirmed</th>
            <th className="px-4 py-3 text-right">Completed</th>
            <th className="px-4 py-3 text-right">Cancelled</th>
            <th className="px-4 py-3 text-right">Total Value</th>
            <th className="px-4 py-3 text-right">Historical agreed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((row, index) => (
            <tr
              key={`${row.metricDate}-${row.bookingSource}-${index}`}
              className="transition-colors hover:bg-neutral-50/50"
            >
              <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                {formatDate(row.metricDate)}
              </td>
              <td className="px-4 py-3 text-sm text-neutral-600">
                {BOOKING_SOURCE_LABELS[
                  row.bookingSource as keyof typeof BOOKING_SOURCE_LABELS
                ] ?? row.bookingSource}
              </td>
              <td className="px-4 py-3 text-right text-sm text-neutral-600">
                {row.bookingsCreatedCount}
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium text-amber-800">
                {row.historicalBookingsCount}
              </td>
              <td className="px-4 py-3 text-right text-sm text-amber-600">
                {row.prospectingBookingsCount}
              </td>
              <td className="px-4 py-3 text-right text-sm text-blue-600">
                {row.confirmedBookingsCount}
              </td>
              <td className="px-4 py-3 text-right text-sm text-emerald-600">
                {row.completedBookingsCount}
              </td>
              <td className="px-4 py-3 text-right text-sm text-rose-600">
                {row.cancelledBookingsCount}
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium text-neutral-900">
                {formatCurrency(row.totalFinalAmount)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-amber-800">
                {formatCurrency(row.historicalAgreedAmount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-200 bg-neutral-50/80 font-bold text-neutral-900">
            <td className="px-4 py-4 text-sm uppercase tracking-wider">Total</td>
            <td className="px-4 py-4 text-sm text-neutral-500">—</td>
            <td className="px-4 py-4 text-right text-sm">
              {totals.bookingsCreatedCount}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {totals.historicalBookingsCount}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {totals.prospectingBookingsCount}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {totals.confirmedBookingsCount}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {totals.completedBookingsCount}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {totals.cancelledBookingsCount}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.totalFinalAmount)}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.historicalAgreedAmount)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
