"use client";

import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { FinanceAnalyticsDailySummaryResponse } from "@/lib/types/finance.types";

interface RevenueTableProps {
  data: FinanceAnalyticsDailySummaryResponse[];
  isLoading: boolean;
}

export function RevenueTable({ data, isLoading }: RevenueTableProps) {
  if (isLoading) {
    return <SkeletonTable rows={10} columns={8} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Revenue rows are not available"
        description="No revenue data for the selected period."
      />
    );
  }

  // Compute totals
  const totals = data.reduce(
    (acc, row) => ({
      bookingsWithInvoiceCount:
        acc.bookingsWithInvoiceCount + row.bookingsWithInvoiceCount,
      totalInvoicedAmount: acc.totalInvoicedAmount + row.totalInvoicedAmount,
      totalPaidAmount: acc.totalPaidAmount + row.totalPaidAmount,
      totalRemainingAmount: acc.totalRemainingAmount + row.totalRemainingAmount,
      totalPendingPayoutAmount:
        acc.totalPendingPayoutAmount + row.totalPendingPayoutAmount,
      totalScheduledPayoutAmount:
        acc.totalScheduledPayoutAmount + row.totalScheduledPayoutAmount,
      totalPaidPayoutAmount:
        acc.totalPaidPayoutAmount + row.totalPaidPayoutAmount,
      historicalEvidenceRecordedAmount:
        acc.historicalEvidenceRecordedAmount + row.historicalEvidenceRecordedAmount,
    }),
    {
      bookingsWithInvoiceCount: 0,
      totalInvoicedAmount: 0,
      totalPaidAmount: 0,
      totalRemainingAmount: 0,
      totalPendingPayoutAmount: 0,
      totalScheduledPayoutAmount: 0,
      totalPaidPayoutAmount: 0,
      historicalEvidenceRecordedAmount: 0,
    }
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[1120px] border-collapse">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <th className="px-4 py-3">Recorded date</th>
            <th className="px-4 py-3 text-right">Invoices</th>
            <th className="px-4 py-3 text-right">Invoiced</th>
            <th className="px-4 py-3 text-right">Platform paid</th>
            <th className="px-4 py-3 text-right">Remaining</th>
            <th className="px-4 py-3 text-right">Historical Payment Evidence</th>
            <th className="px-4 py-3 text-right">Pending Payout</th>
            <th className="px-4 py-3 text-right">Scheduled Payout</th>
            <th className="px-4 py-3 text-right">Paid Payout</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((row) => (
            <tr
              key={row.metricDate}
              className="transition-colors hover:bg-neutral-50/50"
            >
              <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                {formatDate(row.metricDate)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-neutral-600">
                {row.bookingsWithInvoiceCount}
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium text-neutral-900">
                {formatCurrency(row.totalInvoicedAmount)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-emerald-600">
                {formatCurrency(row.totalPaidAmount)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-amber-600">
                {formatCurrency(row.totalRemainingAmount)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-amber-800">
                {formatCurrency(row.historicalEvidenceRecordedAmount)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-neutral-600">
                {formatCurrency(row.totalPendingPayoutAmount)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-blue-600">
                {formatCurrency(row.totalScheduledPayoutAmount)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-emerald-600">
                {formatCurrency(row.totalPaidPayoutAmount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-200 bg-neutral-50/80 font-bold text-neutral-900">
            <td className="px-4 py-4 text-sm uppercase tracking-wider">Total</td>
            <td className="px-4 py-4 text-right text-sm">
              {totals.bookingsWithInvoiceCount}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.totalInvoicedAmount)}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.totalPaidAmount)}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.totalRemainingAmount)}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.historicalEvidenceRecordedAmount)}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.totalPendingPayoutAmount)}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.totalScheduledPayoutAmount)}
            </td>
            <td className="px-4 py-4 text-right text-sm">
              {formatCurrency(totals.totalPaidPayoutAmount)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
