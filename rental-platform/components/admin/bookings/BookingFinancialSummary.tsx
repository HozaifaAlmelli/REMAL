"use client";

import { formatCurrency } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { INVOICE_STATUS_LABELS } from "@/lib/constants/invoice-statuses";
import { PAYOUT_STATUS_LABELS } from "@/lib/constants/payout-statuses";
import type {
  BookingFinanceSnapshotResponse,
  InvoiceStatus,
} from "@/lib/types/booking.types";

interface BookingFinancialSummaryProps {
  snapshot: BookingFinanceSnapshotResponse;
  isHistorical?: boolean;
}

export function BookingFinancialSummary({
  snapshot,
  isHistorical = false,
}: BookingFinancialSummaryProps) {
  const hasOutstanding = snapshot.remainingAmount > 0;

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-700">
        Financial Summary
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Invoiced Amount */}
        <div>
          <p className="text-xs text-neutral-500">Invoiced Amount</p>
          <p className="text-sm font-semibold text-neutral-800">
            {formatCurrency(snapshot.invoicedAmount)}
          </p>
        </div>

        {/* Paid Amount */}
        <div>
          <p className="text-xs text-neutral-500">Platform paid amount</p>
          <p className="text-sm font-semibold text-neutral-800">
            {formatCurrency(snapshot.paidAmount)}
          </p>
        </div>

        {/* Remaining Amount */}
        <div>
          <p className="text-xs text-neutral-500">Remaining Amount</p>
          <p
            className={`text-sm font-semibold ${
              hasOutstanding ? "text-red-600" : "text-green-600"
            }`}
          >
            {formatCurrency(snapshot.remainingAmount)}
          </p>
          {hasOutstanding && (
            <p className="mt-0.5 text-xs text-red-500">Outstanding balance</p>
          )}
        </div>

        {/* Invoice Status */}
        <div>
          <p className="text-xs text-neutral-500">Invoice Status</p>
          {snapshot.invoiceStatus ? (
            <StatusBadge
              status={snapshot.invoiceStatus}
              label={
                INVOICE_STATUS_LABELS[snapshot.invoiceStatus as InvoiceStatus]
              }
            />
          ) : (
            <span className="text-xs italic text-neutral-400">No invoice</span>
          )}
        </div>

        {/* Owner Payout Status */}
        <div className="col-span-2">
          <p className="text-xs text-neutral-500">Owner Payout Status</p>
          {snapshot.ownerPayoutStatus ? (
            <StatusBadge
              status={snapshot.ownerPayoutStatus}
              label={PAYOUT_STATUS_LABELS[snapshot.ownerPayoutStatus]}
            />
          ) : (
            <span className="text-xs italic text-neutral-400">
              No payout created
            </span>
          )}
        </div>
      </div>

      {isHistorical && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          Historical Payment Evidence is reported separately and never reduces this invoice balance.
        </p>
      )}

      {/* Quick status indicator */}
      {hasOutstanding && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          ⚠️ This booking has an outstanding balance of{" "}
          {formatCurrency(snapshot.remainingAmount)}
        </div>
      )}

      {!hasOutstanding && snapshot.paidAmount > 0 && (
        <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-700">
          ✓ Fully paid — no outstanding balance
        </div>
      )}
    </div>
  );
}
