import Link from "next/link";
import type { OwnerPortalFinanceRowResponse } from "@/lib/types/owner-portal.types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { ROUTES } from "@/lib/constants/routes";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface OwnerFinanceTableProps {
  rows: OwnerPortalFinanceRowResponse[];
}

export function OwnerFinanceTable({ rows }: OwnerFinanceTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 font-medium">Booking</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 text-right font-medium">Invoiced</th>
              <th className="px-4 py-3 text-right font-medium">Paid</th>
              <th className="px-4 py-3 text-right font-medium">Remaining</th>
              <th className="px-4 py-3 text-right font-medium">Payout</th>
              <th className="px-4 py-3 font-medium">Payout status</th>
              <th className="px-4 py-3 font-medium">Paid at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((row) => (
              <tr
                key={row.bookingId}
                className="transition-colors hover:bg-neutral-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={ROUTES.owner.bookingDetail(row.bookingId)}
                    className="font-mono text-xs text-primary-600 hover:underline"
                  >
                    {row.bookingId.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={ROUTES.owner.unitDetail(row.unitId)}
                    className="font-mono text-xs text-primary-600 hover:underline"
                  >
                    {row.unitId.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.invoiceStatus} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-900">
                  {formatCurrency(row.invoicedAmount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-900">
                  {formatCurrency(row.paidAmount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {formatCurrency(row.remainingAmount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-900">
                  {row.payoutAmount !== null
                    ? formatCurrency(row.payoutAmount)
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {row.payoutStatus ? (
                    <StatusBadge status={row.payoutStatus} />
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-neutral-600">
                  {formatDate(row.payoutPaidAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
