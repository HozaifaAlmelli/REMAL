"use client";
import { useState } from "react";
import {
  useInvoiceDetail,
  useInvoiceBalance,
  useIssueInvoice,
  useCancelInvoice,
  useCreateInvoiceDraft,
  useReissueInvoice,
} from "@/lib/hooks/useBookings";
import { usePaymentsList } from "@/lib/hooks/usePayments";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { AddAdjustmentModal } from "./AddAdjustmentModal";
import { InvoiceActionDialog } from "@/components/admin/finance/InvoiceActionDialog";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { toastError } from "@/lib/utils/toast";
import { FileText, Plus } from "lucide-react";
import { INVOICE_STATUS_LABELS } from "@/lib/constants/invoice-statuses";
import {
  isFinanceEligibleStatus,
  type BookingStatus,
} from "@/lib/constants/booking-statuses";
import type { InvoiceStatus } from "@/lib/types/booking.types";

interface BookingInvoiceProps {
  bookingId: string;
  invoiceId: string | null;
  bookingStatus?: BookingStatus;
}

export function BookingInvoice({
  bookingId,
  invoiceId,
  bookingStatus,
}: BookingInvoiceProps) {
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showInvoiceActionDialog, setShowInvoiceActionDialog] = useState(false);
  const [cancelNotes, setCancelNotes] = useState("");

  // Invoice + payment endpoints require FinanceOrSuperAdmin; skip the fetches
  // entirely (they poll every 5s) for roles that would only collect 403s.
  const { canViewFinance, canManageFinance } = usePermissions();

  const { data: invoice, isLoading: invoiceLoading } = useInvoiceDetail(
    invoiceId,
    { enabled: canViewFinance }
  );
  const { data: balance, isLoading: balanceLoading } = useInvoiceBalance(
    invoiceId,
    { enabled: canViewFinance }
  );
  const { data: paymentsData } = usePaymentsList(
    { bookingId },
    { enabled: canViewFinance }
  );
  const issueMutation = useIssueInvoice(invoiceId!, bookingId);
  const cancelMutation = useCancelInvoice(invoiceId!, bookingId);
  const createDraftMutation = useCreateInvoiceDraft(bookingId);
  const reissueMutation = useReissueInvoice(invoiceId!, bookingId);

  // Check if there are payment updates that might affect the invoice
  const checkPaymentUpdates = () => {
    if (!paymentsData?.items || !invoice) return null;

    const payments = paymentsData.items;
    const hasFailedPayments = payments.some(
      (p) => p.paymentStatus === "failed"
    );
    const hasCancelledPayments = payments.some(
      (p) => p.paymentStatus === "cancelled"
    );
    const hasPendingPayments = payments.some(
      (p) => p.paymentStatus === "pending"
    );

    // Only show dialog for ISSUED invoices with payment issues
    if (invoice.invoiceStatus?.toLowerCase() !== "issued") {
      return null;
    }

    if (hasFailedPayments) {
      return "This invoice has failed payments. Re-issue it or create a new invoice before continuing.";
    }
    if (hasCancelledPayments) {
      return "This invoice has cancelled payments. Re-issue it or create a new invoice before continuing.";
    }
    if (hasPendingPayments) {
      return "This invoice has pending payments. Re-issue it if the invoice should match the current payment status.";
    }

    return null;
  };

  const handleIssueInvoiceClick = () => {
    // For draft invoices
    if (invoice?.invoiceStatus?.toLowerCase() === "draft") {
      issueMutation.mutate();
      return;
    }

    // For issued invoices, check for payment issues
    const paymentIssue = checkPaymentUpdates();
    if (paymentIssue) {
      setShowInvoiceActionDialog(true);
    }
  };

  const handleReissueInvoice = () => {
    // Use the backend's ReissueAsync endpoint which marks old invoice as "superseded"
    // This works even when the invoice has paid payments

    reissueMutation.mutate(
      {
        notes: "Re-issued invoice due to payment updates",
      },
      {
        onSuccess: () => {
          setShowInvoiceActionDialog(false);
        },
        onError: () => {
          toastError("Could not re-issue invoice");
        },
      }
    );
  };

  const handleCreateNewInvoice = () => {
    // Cancel the old invoice and create a completely new draft
    // This is different from re-issue which marks old as "superseded"

    if (!invoiceId) {
      toastError("No invoice to replace");
      return;
    }

    // First cancel the old invoice
    cancelMutation.mutate(
      { notes: "Cancelled to create new invoice due to payment updates" },
      {
        onSuccess: () => {
          // Then create a new draft invoice
          createDraftMutation.mutate(
            { notes: "Replacement invoice draft due to payment updates" },
            {
              onSuccess: () => {
                setShowInvoiceActionDialog(false);
              },
              onError: () => {
                toastError("Could not create replacement invoice");
              },
            }
          );
        },
        onError: () => {
          // If cancellation fails (e.g., has paid payments), use re-issue instead
          toastError(
            "Cannot cancel invoice with paid payments. Use re-issue instead."
          );
          setShowInvoiceActionDialog(false);
        },
      }
    );
  };

  const handleSkipInvoiceAction = () => {
    // User wants to proceed with issuing anyway despite payment issues

    if (invoice?.invoiceStatus?.toLowerCase() !== "draft") {
      toastError("Cannot issue: invoice must be in draft status");
      setShowInvoiceActionDialog(false);
      return;
    }

    issueMutation.mutate(undefined, {
      onSuccess: () => {
        setShowInvoiceActionDialog(false);
      },
    });
  };

  if (!canViewFinance) {
    return (
      <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-500">
        Invoice details are available to Finance and Super Admin roles.
      </p>
    );
  }

  if (!invoiceId) {
    const financeEligible = isFinanceEligibleStatus(bookingStatus);
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="Invoice not issued"
          description="Create a draft invoice before issuing billing for this booking."
        />
        {canManageFinance && !financeEligible && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-center text-xs text-neutral-600">
            An invoice cannot be created while this booking is{" "}
            <span className="font-semibold">{bookingStatus}</span>. Only active
            bookings (Booked, Confirmed, Check-in, Completed, or Left early) can
            be invoiced.
          </div>
        )}
        {canManageFinance && financeEligible && (
          <div className="space-y-2">
            <div className="flex justify-center">
              <Button
                variant="primary"
                onClick={() => {
                  createDraftMutation.mutate({});
                }}
                isLoading={createDraftMutation.isPending}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Create invoice draft
              </Button>
            </div>
            {createDraftMutation.isError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">Could not create invoice</p>
                <p className="mt-1 text-xs">
                  {(createDraftMutation.error as Error)?.message ||
                    "The invoice service did not return a detailed error."}
                </p>
                <p className="mt-1 text-xs text-red-600">
                  Retry after checking booking and payment details.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (invoiceLoading || balanceLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!invoice) return null;

  // Normalize invoice status to handle case differences (DB returns lowercase, types expect capitalized)
  const normalizedStatus =
    invoice.invoiceStatus.charAt(0).toUpperCase() +
    invoice.invoiceStatus.slice(1).toLowerCase();
  const isDraft = normalizedStatus === "Draft";
  const isIssued = normalizedStatus === "Issued";
  const isCancelled = normalizedStatus === "Cancelled";
  const isSuperseded = normalizedStatus === "Superseded";
  const isPaid = normalizedStatus === "Paid";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Invoice</h3>
        <StatusBadge
          status={invoice.invoiceStatus}
          label={INVOICE_STATUS_LABELS[invoice.invoiceStatus as InvoiceStatus]}
        />
      </div>

      <div className="space-y-3 rounded-lg bg-neutral-50 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-neutral-500">Invoice number</p>
            <p className="text-sm font-medium text-neutral-800">
              {invoice.invoiceNumber}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Subtotal</p>
            <p className="text-sm font-medium text-neutral-800">
              {formatCurrency(invoice.subtotalAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total</p>
            <p className="text-sm font-semibold text-neutral-800">
              {formatCurrency(invoice.totalAmount)}
            </p>
          </div>
          {balance && (
            <>
              <div>
                <p className="text-xs text-neutral-500">Paid</p>
                <p className="text-sm font-medium text-green-600">
                  {formatCurrency(balance.paidAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Remaining</p>
                <p
                  className={`text-sm font-semibold ${balance.remainingAmount > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {formatCurrency(balance.remainingAmount)}
                </p>
              </div>
            </>
          )}
          {invoice.issuedAt && (
            <div>
              <p className="text-xs text-neutral-500">Issued</p>
              <p className="text-sm text-neutral-800">
                {formatDate(invoice.issuedAt)}
              </p>
            </div>
          )}
          {invoice.dueDate && (
            <div>
              <p className="text-xs text-neutral-500">Due date</p>
              <p className="text-sm text-neutral-800">
                {formatDate(invoice.dueDate)}
              </p>
            </div>
          )}
        </div>

        {invoice.items && invoice.items.length > 0 && (
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <p className="mb-2 text-xs font-medium text-neutral-500">
              Line items
            </p>
            <div className="space-y-1">
              {invoice.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs">
                  <span
                    className="mr-2 truncate text-neutral-600"
                    title={item.description}
                  >
                    {item.description}{" "}
                    {item.quantity > 1 ? `× ${item.quantity}` : ""}
                  </span>
                  <span
                    className={`whitespace-nowrap font-medium ${item.unitAmount < 0 ? "text-red-600" : "text-neutral-800"}`}
                  >
                    {formatCurrency(item.quantity * item.unitAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Show re-issue button for ANY invoice status if there are payments */}
      {canManageFinance &&
        paymentsData?.items &&
        paymentsData.items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowInvoiceActionDialog(true)}
            >
              Re-issue invoice
            </Button>
          </div>
        )}

      {canManageFinance && isDraft && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="success"
            onClick={handleIssueInvoiceClick}
            isLoading={issueMutation.isPending}
          >
            Issue invoice
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowAdjustmentModal(true)}
          >
            Add adjustment
          </Button>
          <Button variant="danger" onClick={() => setShowCancelConfirm(true)}>
            Cancel invoice
          </Button>
        </div>
      )}

      {isIssued && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
          This invoice has been issued and is read-only. No further
          changes are allowed.
        </div>
      )}

      {isCancelled && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          This invoice has been cancelled.
        </div>
      )}

      {isSuperseded && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-700">
          This invoice has been superseded by a newer invoice.
        </div>
      )}

      {isPaid && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
          This invoice has been fully paid.
        </div>
      )}

      {showAdjustmentModal && (
        <AddAdjustmentModal
          isOpen={showAdjustmentModal}
          onClose={() => setShowAdjustmentModal(false)}
          invoiceId={invoiceId}
          bookingId={bookingId}
        />
      )}

      {showInvoiceActionDialog && invoice && (
        <InvoiceActionDialog
          isOpen={showInvoiceActionDialog}
          onClose={() => setShowInvoiceActionDialog(false)}
          onReissue={handleReissueInvoice}
          onCreateNew={handleCreateNewInvoice}
          onSkip={handleSkipInvoiceAction}
          invoiceNumber={invoice.invoiceNumber}
          reason={checkPaymentUpdates() || "Payment status has changed"}
          isLoading={
            issueMutation.isPending ||
            cancelMutation.isPending ||
            createDraftMutation.isPending ||
            reissueMutation.isPending
          }
        />
      )}

      <Modal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Cancel invoice"
      >
        <div className="space-y-4 py-4">
          <p className="text-sm text-neutral-600">
            Cancel this invoice? This cannot be undone, and the invoice will no
            longer be used for payment tracking.
          </p>
          <textarea
            value={cancelNotes}
            onChange={(e) => setCancelNotes(e.target.value)}
            placeholder="Add the cancellation reason"
            className="h-16 w-full resize-none rounded-md border border-neutral-200 p-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            disabled={cancelMutation.isPending}
          />
        </div>
        <ModalFooter>
          <div className="flex w-full justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirm(false)}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                cancelMutation.mutate(
                  { notes: cancelNotes || undefined },
                  { onSuccess: () => setShowCancelConfirm(false) }
                );
              }}
              isLoading={cancelMutation.isPending}
            >
              Cancel invoice
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
}
