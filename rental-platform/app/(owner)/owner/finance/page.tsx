"use client";

import { useState, useMemo } from "react";
import {
  useOwnerFinanceSummary,
  useOwnerFinanceRows,
} from "@/lib/hooks/useOwnerPortal";
import { OwnerFinanceSummary } from "@/components/owner/finance/OwnerFinanceSummary";
import { OwnerFinanceTable } from "@/components/owner/finance/OwnerFinanceTable";
import { Button } from "@/components/ui/Button";

export default function OwnerFinancePage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useOwnerFinanceSummary();

  const {
    data: financeData,
    isLoading: financeLoading,
    error: financeError,
    refetch: refetchFinance,
  } = useOwnerFinanceRows({
    page,
    pageSize,
  });

  const rows = useMemo(() => financeData?.items || [], [financeData?.items]);
  const pagination = financeData?.pagination;

  // Calculate dynamic summary directly from transactions
  const dynamicSummary = useMemo(() => {
    return rows.reduce(
      (acc, transaction) => {
        return {
          ...acc,
          totalInvoicedAmount:
            acc.totalInvoicedAmount + (transaction.invoicedAmount || 0),
          totalPaidAmount: acc.totalPaidAmount + (transaction.paidAmount || 0),
          totalRemainingAmount:
            acc.totalRemainingAmount + (transaction.remainingAmount || 0),
          totalPendingPayoutAmount:
            acc.totalPendingPayoutAmount +
            (transaction.payoutStatus === "pending"
              ? transaction.payoutAmount || 0
              : 0),
          totalScheduledPayoutAmount:
            acc.totalScheduledPayoutAmount +
            (transaction.payoutStatus === "scheduled"
              ? transaction.payoutAmount || 0
              : 0),
          totalPaidPayoutAmount:
            acc.totalPaidPayoutAmount +
            (transaction.payoutStatus === "paid"
              ? transaction.payoutAmount || 0
              : 0),
        };
      },
      {
        ownerId: "derived",
        totalInvoicedAmount: 0,
        totalPaidAmount: 0,
        totalRemainingAmount: 0,
        totalPendingPayoutAmount: 0,
        totalScheduledPayoutAmount: 0,
        totalPaidPayoutAmount: 0,
      }
    );
  }, [rows]);

  // Loading state
  if (summaryLoading || financeLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Finance
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            View your financial summary and transaction history
          </p>
        </div>

        {/* Skeleton summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-lg bg-neutral-200"
            />
          ))}
        </div>

        {/* Skeleton table */}
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="h-12 animate-pulse bg-neutral-100" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse border-t border-neutral-200 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (summaryError || !summaryData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Finance
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            View your financial summary and transaction history
          </p>
        </div>

        <div className="rounded-lg border border-error/30 bg-error/5 p-6">
          <h2 className="text-lg font-semibold text-error">
            Failed to load finance summary
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            We could not load your financial summary.
          </p>
          <Button
            variant="outline"
            onClick={() => refetchSummary()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (financeError || !financeData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Finance
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            View your financial summary and transaction history
          </p>
        </div>

        {/* Show summary even if table fails */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">
            Financial Summary
          </h2>
          <OwnerFinanceSummary summary={dynamicSummary} />
        </section>

        <div className="rounded-lg border border-error/30 bg-error/5 p-6">
          <h2 className="text-lg font-semibold text-error">
            Failed to load finance records
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            We could not load your financial records.
          </p>
          <Button
            variant="outline"
            onClick={() => refetchFinance()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Finance</h1>
        <p className="mt-1 text-sm text-neutral-500">
          View your financial summary and transaction history
        </p>
      </div>

      {/* Financial Summary */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">
          Financial Summary
        </h2>
        <OwnerFinanceSummary summary={dynamicSummary} />
      </section>

      {/* Per-Booking Finance Records */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">
          Transaction History
        </h2>

        {/* Empty state */}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center shadow-sm">
            <p className="text-lg font-medium text-neutral-900">
              No financial records yet
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Your transaction history will appear here once bookings are
              invoiced.
            </p>
          </div>
        ) : (
          <>
            {/* Finance table */}
            <OwnerFinanceTable rows={rows} />

            {/* Pagination */}
            {pagination && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">
                  Showing {rows.length} of {pagination.totalCount} records
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-3">
                    <span className="text-sm text-neutral-600">
                      Page {page} of {pagination.totalPages}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Read-only notice */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm text-neutral-600">
          <strong className="font-semibold text-neutral-900">Note:</strong> This
          is a read-only view of your financial records. For payout inquiries or
          adjustments, please contact your account manager.
        </p>
      </div>
    </div>
  );
}
