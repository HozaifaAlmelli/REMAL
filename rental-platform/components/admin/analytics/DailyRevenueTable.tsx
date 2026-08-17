"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { FinanceAnalyticsDailySummaryResponse } from "@/lib/types/report.types";

interface DailyRevenueTableProps {
  data: FinanceAnalyticsDailySummaryResponse[];
  isLoading: boolean;
}

export function DailyRevenueTable({ data, isLoading }: DailyRevenueTableProps) {
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
        title="Daily revenue is not available"
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
      historicalEvidenceRecordedCount:
        acc.historicalEvidenceRecordedCount + row.historicalEvidenceRecordedCount,
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
      historicalEvidenceRecordedCount: 0,
      historicalEvidenceRecordedAmount: 0,
    }
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-neutral-500">
            <th className="p-3">Recorded date</th>
            <th className="p-3">Invoices</th>
            <th className="p-3">Invoiced</th>
            <th className="p-3">Platform paid</th>
            <th className="p-3">Remaining</th>
            <th className="p-3">Historical Payment Evidence</th>
            <th className="p-3">Pending Payout</th>
            <th className="p-3">Scheduled Payout</th>
            <th className="p-3">Paid Payout</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.metricDate} className="border-b hover:bg-neutral-50">
              <td className="p-3 text-sm">{formatDate(row.metricDate)}</td>
              <td className="p-3 text-sm">{row.bookingsWithInvoiceCount}</td>
              <td className="p-3 text-sm">
                {formatCurrency(row.totalInvoicedAmount)}
              </td>
              <td className="p-3 text-sm">
                {formatCurrency(row.totalPaidAmount)}
              </td>
              <td className="p-3 text-sm">
                {formatCurrency(row.totalRemainingAmount)}
              </td>
              <td className="p-3 text-sm text-amber-800">
                {formatCurrency(row.historicalEvidenceRecordedAmount)} ({row.historicalEvidenceRecordedCount})
              </td>
              <td className="p-3 text-sm">
                {formatCurrency(row.totalPendingPayoutAmount)}
              </td>
              <td className="p-3 text-sm">
                {formatCurrency(row.totalScheduledPayoutAmount)}
              </td>
              <td className="p-3 text-sm">
                {formatCurrency(row.totalPaidPayoutAmount)}
              </td>
            </tr>
          ))}
          {/* Totals row */}
          <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
            <td className="p-3 text-sm">Total</td>
            <td className="p-3 text-sm">{totals.bookingsWithInvoiceCount}</td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.totalInvoicedAmount)}
            </td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.totalPaidAmount)}
            </td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.totalRemainingAmount)}
            </td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.historicalEvidenceRecordedAmount)} ({totals.historicalEvidenceRecordedCount})
            </td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.totalPendingPayoutAmount)}
            </td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.totalScheduledPayoutAmount)}
            </td>
            <td className="p-3 text-sm">
              {formatCurrency(totals.totalPaidPayoutAmount)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
