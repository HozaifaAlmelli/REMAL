import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import type { FinanceAnalyticsStayDailySummaryResponse } from "@/lib/types/report.types";
import { formatCurrency, formatDate } from "@/lib/utils/format";

export function StayFinanceTable({
  data,
  isLoading,
}: {
  data: FinanceAnalyticsStayDailySummaryResponse[];
  isLoading: boolean;
}) {
  if (isLoading) return <SkeletonTable rows={6} columns={8} />;
  if (data.length === 0) {
    return (
      <EmptyState
        title="No stay finance rows"
        description="No contracted or invoiced stay value matches this period."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase text-neutral-500">
            <th className="p-3">Stay start</th>
            <th className="p-3 text-right">Stays</th>
            <th className="p-3 text-right">With invoice</th>
            <th className="p-3 text-right">Invoiced value</th>
            <th className="p-3 text-right">Booking value</th>
            <th className="p-3 text-right">Historical stays</th>
            <th className="p-3 text-right">Historical agreed</th>
            <th className="p-3 text-right">Historical invoiced</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((row) => (
            <tr key={row.stayStartDate}>
              <td className="p-3 text-sm font-medium text-neutral-900">
                {formatDate(row.stayStartDate)}
              </td>
              <td className="p-3 text-right text-sm">{row.stayBookingsCount}</td>
              <td className="p-3 text-right text-sm">{row.bookingsWithInvoiceCount}</td>
              <td className="p-3 text-right text-sm">{formatCurrency(row.totalInvoicedAmount)}</td>
              <td className="p-3 text-right text-sm">{formatCurrency(row.totalFinalAmount)}</td>
              <td className="p-3 text-right text-sm font-medium text-amber-800">{row.historicalBookingsCount}</td>
              <td className="p-3 text-right text-sm text-amber-800">{formatCurrency(row.historicalAgreedAmount)}</td>
              <td className="p-3 text-right text-sm text-amber-800">{formatCurrency(row.historicalInvoicedAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
        Stay finance shows booking and invoiced value at stay start. It does not attribute cash or Historical Payment Evidence to a stay date.
      </p>
    </div>
  );
}
