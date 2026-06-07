import type { OwnerPortalFinanceSummaryResponse } from "@/lib/types/owner-portal.types";
import { formatCurrency } from "@/lib/utils/format";

interface OwnerFinanceSummaryProps {
  summary: OwnerPortalFinanceSummaryResponse;
}

const SUMMARY_CARDS = [
  { key: "totalInvoicedAmount", label: "Total invoiced" },
  { key: "totalPaidAmount", label: "Total paid" },
  { key: "totalRemainingAmount", label: "Total remaining" },
  { key: "totalPendingPayoutAmount", label: "Pending payout" },
  { key: "totalScheduledPayoutAmount", label: "Scheduled payout" },
  { key: "totalPaidPayoutAmount", label: "Paid payout" },
] as const;

export function OwnerFinanceSummary({ summary }: OwnerFinanceSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SUMMARY_CARDS.map((card) => (
        <div
          key={card.key}
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-neutral-500">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-neutral-900">
            {formatCurrency(summary[card.key])}
          </p>
        </div>
      ))}
    </div>
  );
}
