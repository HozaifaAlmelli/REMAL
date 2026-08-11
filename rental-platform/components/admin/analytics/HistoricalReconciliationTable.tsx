import { EmptyState } from "@/components/ui/EmptyState";
import { HistoricalBadge } from "@/components/ui/HistoricalBadge";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import type { HistoricalEntryReconciliationResponse } from "@/lib/types/report.types";
import { formatHistoricalProvenance } from "@/lib/historical-reporting/presentation";
import { formatCurrency, formatDate, referenceCode } from "@/lib/utils/format";

export function HistoricalReconciliationTable({
  data,
  isLoading,
}: {
  data: HistoricalEntryReconciliationResponse[];
  isLoading: boolean;
}) {
  if (isLoading) return <SkeletonTable rows={6} columns={9} />;
  if (data.length === 0) {
    return (
      <EmptyState
        title="No Historical records to reconcile"
        description="No Historical Booking stays fall in the selected stay months."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full min-w-[1180px]">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase text-neutral-500">
            <th className="p-3">Booking</th>
            <th className="p-3">Recorded</th>
            <th className="p-3">Actual booked</th>
            <th className="p-3 text-right">Entry lag</th>
            <th className="p-3">Stay</th>
            <th className="p-3">Provenance</th>
            <th className="p-3 text-right">Agreed / invoiced</th>
            <th className="p-3 text-right">Platform paid / unlinked</th>
            <th className="p-3 text-right">Historical Payment Evidence</th>
            <th className="p-3 text-right">Owner corrections</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((row) => (
            <tr key={row.bookingId}>
              <td className="p-3">
                <div className="flex flex-col items-start gap-1">
                  <span className="font-mono text-xs text-neutral-700">
                    {referenceCode("BKG", row.bookingId)}
                  </span>
                  <HistoricalBadge />
                </div>
              </td>
              <td className="p-3 text-sm">{formatDate(row.recordedDate)}</td>
              <td className="p-3 text-sm">{formatDate(row.actualBookedAt)}</td>
              <td className="p-3 text-right text-sm tabular-nums">{row.entryLagDays}d</td>
              <td className="p-3 text-sm">
                {formatDate(row.stayStartDate)} – {formatDate(row.stayEndDate)}
              </td>
              <td className="p-3 text-sm">{formatHistoricalProvenance(row.originalSource)}</td>
              <td className="p-3 text-right text-sm">
                {formatCurrency(row.agreedAmount)} / {formatCurrency(row.invoicedAmount)}
              </td>
              <td className="p-3 text-right text-sm">
                {formatCurrency(row.invoiceLinkedPaidAmount)} / {formatCurrency(row.ordinaryUnlinkedPaidAmount)}
              </td>
              <td className="p-3 text-right text-sm text-amber-800">
                {formatCurrency(row.historicalPaymentEvidenceAmount)} ({row.historicalPaymentEvidenceCount})
              </td>
              <td className="p-3 text-right text-sm">{row.ownerAttributionCorrectionCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
