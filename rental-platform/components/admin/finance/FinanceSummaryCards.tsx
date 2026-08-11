"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/utils/format";
import type { FinanceAnalyticsSummaryResponse } from "@/lib/types/finance.types";

interface FinanceSummaryCardsProps {
  data?: FinanceAnalyticsSummaryResponse;
  isLoading: boolean;
}

interface SummaryCell {
  label: string;
  value: string;
}

function SummaryGroup({
  title,
  cells,
  columns,
  isLoading,
}: {
  title: string;
  cells: SummaryCell[];
  columns: string;
  isLoading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white">
      <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-600">
        {title}
      </h2>
      <dl className={`grid divide-x divide-neutral-200 ${columns}`}>
        {cells.map((cell) => (
          <div key={cell.label} className="px-5 py-4">
            <dt className="text-[12px] font-medium text-neutral-600">
              {cell.label}
            </dt>
            {isLoading ? (
              <Skeleton className="mt-2 h-7 w-24" />
            ) : (
              <dd className="mt-1 text-[30px] font-semibold tabular-nums leading-none text-neutral-900">
                {cell.value}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FinanceSummaryCards({
  data,
  isLoading,
}: FinanceSummaryCardsProps) {
  const money = (amount?: number | null) =>
    amount ? formatCurrency(amount) : "—";

  const invoicing: SummaryCell[] = [
    { label: "Total invoiced", value: money(data?.totalInvoicedAmount) },
    { label: "Platform paid", value: money(data?.totalPaidAmount) },
    { label: "Outstanding balance", value: money(data?.totalRemainingAmount) },
    {
      label: "Bookings with invoice",
      value: data ? data.totalBookingsWithInvoiceCount.toString() : "—",
    },
  ];

  const payouts: SummaryCell[] = [
    { label: "Pending", value: money(data?.totalPendingPayoutAmount) },
    { label: "Scheduled", value: money(data?.totalScheduledPayoutAmount) },
    { label: "Paid out", value: money(data?.totalPaidPayoutAmount) },
  ];

  const historical: SummaryCell[] = [
    {
      label: "Historical agreed value",
      value: money(data?.historicalAgreedAmount),
    },
    {
      label: "Historical Payment Evidence",
      value: money(data?.historicalPaymentEvidenceAmount),
    },
    {
      label: "Evidence records",
      value: data ? data.historicalPaymentEvidenceCount.toString() : "—",
    },
    {
      label: "Historical invoiced",
      value: money(data?.historicalInvoicedAmount),
    },
  ];

  return (
    <div className="space-y-4">
      <SummaryGroup
        title="Invoicing"
        cells={invoicing}
        columns="grid-cols-2 md:grid-cols-4"
        isLoading={isLoading}
      />
      <SummaryGroup
        title="Owner payouts"
        cells={payouts}
        columns="grid-cols-3"
        isLoading={isLoading}
      />
      <SummaryGroup
        title="Historical evidence and value"
        cells={historical}
        columns="grid-cols-2 md:grid-cols-4"
        isLoading={isLoading}
      />
      <p className="text-xs text-neutral-600">
        Historical Payment Evidence records money received outside KAZA. It is not platform paid, invoice settlement, or owner payout.
      </p>
    </div>
  );
}
