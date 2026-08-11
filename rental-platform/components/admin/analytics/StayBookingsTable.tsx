import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import type { BookingAnalyticsStayDailySummaryResponse } from "@/lib/types/report.types";
import { formatCurrency, formatDate } from "@/lib/utils/format";

export function StayBookingsTable({
  data,
  isLoading,
}: {
  data: BookingAnalyticsStayDailySummaryResponse[];
  isLoading: boolean;
}) {
  if (isLoading) return <SkeletonTable rows={6} columns={7} />;
  if (data.length === 0) {
    return (
      <EmptyState
        title="No stays in this period"
        description="No booking stays match the selected dates and booking type."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase text-neutral-500">
            <th className="p-3">Stay start</th>
            <th className="p-3">KAZA source</th>
            <th className="p-3 text-right">Stays</th>
            <th className="p-3 text-right">Historical</th>
            <th className="p-3 text-right">Booking value</th>
            <th className="p-3 text-right">Historical agreed</th>
            <th className="p-3">Historical provenance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((row) => (
            <tr key={`${row.stayStartDate}-${row.bookingSource}`}>
              <td className="p-3 text-sm font-medium text-neutral-900">
                {formatDate(row.stayStartDate)}
              </td>
              <td className="p-3 text-sm text-neutral-600">
                {BOOKING_SOURCE_LABELS[
                  row.bookingSource as keyof typeof BOOKING_SOURCE_LABELS
                ] ?? row.bookingSource}
              </td>
              <td className="p-3 text-right text-sm">{row.stayBookingsCount}</td>
              <td className="p-3 text-right text-sm font-medium text-amber-800">
                {row.historicalBookingsCount}
              </td>
              <td className="p-3 text-right text-sm">
                {formatCurrency(row.totalFinalAmount)}
              </td>
              <td className="p-3 text-right text-sm text-amber-800">
                {formatCurrency(row.historicalAgreedAmount)}
              </td>
              <td className="p-3 text-xs text-neutral-600">
                Legacy {row.historicalLegacySystemBookingsCount} · External {row.historicalExternalPlatformBookingsCount} · Offline {row.historicalOfflineRecordBookingsCount} · Other {row.historicalOtherSourceBookingsCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
