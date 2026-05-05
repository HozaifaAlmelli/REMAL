"use client";
import { useState } from "react";
import {
  useInvoiceDetail,
  useInvoiceBalance,
  useIssueInvoice,
  useCancelInvoice,
  useCreateInvoiceDraft,
} from "@/lib/hooks/useBookings";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { AddAdjustmentModal } from "./AddAdjustmentModal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { FileText, Plus } from "lucide-react";
import { INVOICE_STATUS_LABELS } from "@/lib/constants/invoice-statuses";
import type { InvoiceStatus } from "@/lib/types/booking.types";

interface BookingInvoiceProps {
  bookingId: string;
  invoiceId: string | null;
}

export function BookingInvoice({ bookingId, invoiceId }: BookingInvoiceProps) {
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelNotes, setCancelNotes] = useState("");

  const { data: invoice, isLoading: invoiceLoading } =
    useInvoiceDetail(invoiceId);
  const { data: balance, isLoading: balanceLoading } =
    useInvoiceBalance(invoiceId);
  const issueMutation = useIssueInvoice(invoiceId!, bookingId);
  const cancelMutation = useCancelInvoice(invoiceId!, bookingId);
  const createDraftMutation = useCreateInvoiceDraft(bookingId);
  const { canManageFinance } = usePermissions();

  if (!invoiceId) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No invoice yet"
          description="Create an invoice draft for this booking to proceed with billing"
        />
        {canManageFinance && (
          <div className="space-y-2">
            <div className="flex justify-center">
              <Button
                variant="primary"
                onClick={() => {
                  console.log(
                    "Create Invoice button clicked for booking:",
                    bookingId
                  );
                  // Generate invoice number: INV-YYYYMMDD-XXXXX
                  const now = new Date();
                  const dateStr = now
                    .toISOString()
                    .slice(0, 10)
                    .replace(/-/g, "");
                  const randomStr = Math.random()
                    .toString(36)
                    .substring(2, 7)
                    .toUpperCase();
                  const invoiceNumber = `INV-${dateStr}-${randomStr}`;

                  console.log("Generated invoice number:", invoiceNumber);
                  createDraftMutation.mutate({ invoiceNumber });
                }}
                isLoading={createDraftMutation.isPending}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Create Invoice Draft
              </Button>
            </div>
            {createDraftMutation.isError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">Failed to create invoice</p>
                <p className="mt-1 text-xs">
                  {(createDraftMutation.error as Error)?.message ||
                    "Unknown error occurred"}
                </p>
                <p className="mt-1 text-xs text-red-600">
                  Check browser console for details
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
            <p className="text-xs text-neutral-500">Invoice Number</p>
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
              <p className="text-xs text-neutral-500">Issued At</p>
              <p className="text-sm text-neutral-800">
                {formatDate(invoice.issuedAt)}
              </p>
            </div>
          )}
          {invoice.dueDate && (
            <div>
              <p className="text-xs text-neutral-500">Due Date</p>
              <p className="text-sm text-neutral-800">
                {formatDate(invoice.dueDate)}
              </p>
            </div>
          )}
        </div>

        {invoice.items && invoice.items.length > 0 && (
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <p className="mb-2 text-xs font-medium text-neutral-500">
              Line Items
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

      {canManageFinance && isDraft && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="success"
            onClick={() => issueMutation.mutate()}
            isLoading={issueMutation.isPending}
          >
            Issue Invoice
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowAdjustmentModal(true)}
          >
            Add Adjustment
          </Button>
          <Button variant="danger" onClick={() => setShowCancelConfirm(true)}>
            Cancel Invoice
          </Button>
        </div>
      )}

      {/* Debug info */}
      <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
        <div className="font-semibold">Debug Info:</div>
        <div>canManageFinance: {canManageFinance ? "✅ true" : "❌ false"}</div>
        <div>isDraft: {isDraft ? "✅ true" : "❌ false"}</div>
        <div>Invoice Status: {invoice.invoiceStatus}</div>
        <div>
          Should show buttons:{" "}
          {canManageFinance && isDraft ? "✅ YES" : "❌ NO"}
        </div>
      </div>

      {/* Temporary Issue Button - Always Show for Draft */}
      {isDraft && (
        <div className="rounded-md border-2 border-yellow-300 bg-yellow-50 p-4">
          <p className="mb-2 text-sm font-semibold text-yellow-800">
            ⚠️ Temporary Issue Button (for testing)
          </p>
          <Button
            variant="success"
            onClick={() => {
              console.log("Issuing invoice:", invoice.id);
              issueMutation.mutate();
            }}
            isLoading={issueMutation.isPending}
          >
            🚀 Issue Invoice Now
          </Button>
        </div>
      )}

      {isIssued && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
          This invoice has been issued and is read-only. No further
          modifications allowed.
        </div>
      )}

      {isCancelled && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          This invoice has been cancelled.
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

      <Modal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Cancel Invoice"
      >
        <div className="space-y-4 py-4">
          <p className="text-sm text-neutral-600">
            Are you sure you want to cancel this invoice? This action cannot be
            undone.
          </p>
          <textarea
            value={cancelNotes}
            onChange={(e) => setCancelNotes(e.target.value)}
            placeholder="Cancellation reason (optional)"
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
              Cancel Invoice
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
}
