import { useState } from "react";
import {
  useBookingPayments,
  useMarkPaymentPaid,
  useMarkPaymentFailed,
  useCancelPayment,
} from "@/lib/hooks/useBookings";
import { useLinkPaidPaymentsToInvoices } from "@/lib/hooks/usePayments";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-methods";
import {
  isFinanceEligibleStatus,
  type BookingStatus,
} from "@/lib/constants/booking-statuses";
import { CreditCard, Link } from "lucide-react";

interface BookingPaymentsProps {
  bookingId: string;
  bookingStatus?: BookingStatus;
  remainingAmount?: number | null;
}

export function BookingPayments({
  bookingId,
  bookingStatus,
  remainingAmount,
}: BookingPaymentsProps) {
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [failedPaymentId, setFailedPaymentId] = useState<string | null>(null);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [failedNotes, setFailedNotes] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  // Payment endpoints (PaymentsController) require FinanceOrSuperAdmin;
  // gate on the matching capability only, so other roles never see actions
  // (or trigger fetches) that are guaranteed to 403.
  const { canViewFinance, canManageFinance } = usePermissions();
  const financeEligible = isFinanceEligibleStatus(bookingStatus);
  const canRecordPayment = canManageFinance && financeEligible;

  const { data: payments, isLoading } = useBookingPayments(bookingId, {
    enabled: canViewFinance,
  });
  const markPaidMutation = useMarkPaymentPaid(bookingId);
  const markFailedMutation = useMarkPaymentFailed(bookingId);
  const cancelMutation = useCancelPayment(bookingId);
  const linkPaymentsMutation = useLinkPaidPaymentsToInvoices();

  // Check if there are unlinked paid payments
  const hasUnlinkedPaidPayments =
    payments?.items.some((p) => p.paymentStatus === "paid" && !p.invoiceId) ??
    false;

  if (!canViewFinance) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-700">Payments</h3>
        <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-500">
          Payment records are available to Finance and Super Admin roles.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Payments</h3>
        <div className="flex gap-2">
          {canRecordPayment && hasUnlinkedPaidPayments && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => linkPaymentsMutation.mutate()}
              isLoading={linkPaymentsMutation.isPending}
              leftIcon={<Link className="h-4 w-4" />}
            >
              Link paid payments
            </Button>
          )}
          {canRecordPayment && (
            <Button size="sm" onClick={() => setShowRecordModal(true)}>
              Record payment
            </Button>
          )}
        </div>
      </div>

      {canManageFinance && !financeEligible && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
          Payments cannot be recorded while this booking is{" "}
          <span className="font-semibold">{bookingStatus}</span>. Only active
          bookings (Booked, Confirmed, Check-in, Completed, or Left early) can be
          charged.
        </div>
      )}

      {hasUnlinkedPaidPayments && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-700">
          Some paid payments are not linked to an invoice. Link paid payments
          to keep invoice balances accurate.
        </div>
      )}

      {!payments || payments.items.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title="No payments recorded"
          description="Record the first payment when finance verifies a receipt for this booking."
        />
      ) : (
        <div className="space-y-2">
          {payments.items.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between rounded-lg bg-neutral-50 p-3"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-800">
                    {formatCurrency(payment.amount)}
                  </span>
                  <StatusBadge status={payment.paymentStatus} />
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>
                    {PAYMENT_METHOD_LABELS[
                      payment.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS
                    ] ?? payment.paymentMethod}
                  </span>
                  <span>{formatDate(payment.paidAt ?? payment.createdAt)}</span>
                  {payment.referenceNumber && (
                    <span>Ref: {payment.referenceNumber}</span>
                  )}
                </div>
              </div>

              {canRecordPayment &&
                payment.paymentStatus?.trim().toLowerCase() === "pending" && (
                  <div className="flex gap-1">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => markPaidMutation.mutate(payment.id)}
                      isLoading={
                        markPaidMutation.isPending &&
                        markPaidMutation.variables === payment.id
                      }
                    >
                      Mark paid
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setFailedPaymentId(payment.id);
                        setFailedNotes("");
                      }}
                    >
                      Mark failed
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCancelPaymentId(payment.id);
                        setCancelNotes("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        bookingId={bookingId}
        remainingAmount={remainingAmount ?? undefined}
      />

      {/* Mark Failed Dialog */}
      <Modal
        isOpen={!!failedPaymentId}
        onClose={() => setFailedPaymentId(null)}
        title="Mark payment as failed"
        size="sm"
      >
        <div className="space-y-4 py-4">
          <p className="text-sm text-neutral-600">
            Mark this payment as failed? The booking balance will remain open.
          </p>
          <textarea
            value={failedNotes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFailedNotes(e.target.value)
            }
            placeholder="Add the failure reason"
            className="mt-2 h-16 w-full resize-none rounded-md border border-neutral-200 p-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            disabled={markFailedMutation.isPending}
          />
        </div>
        <ModalFooter>
          <div className="flex w-full justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setFailedPaymentId(null)}
              disabled={markFailedMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!failedPaymentId) return;
                markFailedMutation.mutate(
                  {
                    paymentId: failedPaymentId,
                    data: { notes: failedNotes || undefined },
                  },
                  { onSuccess: () => setFailedPaymentId(null) }
                );
              }}
              isLoading={markFailedMutation.isPending}
            >
              Mark payment failed
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Cancel Payment Dialog */}
      <Modal
        isOpen={!!cancelPaymentId}
        onClose={() => setCancelPaymentId(null)}
        title="Cancel payment"
        size="sm"
      >
        <div className="space-y-4 py-4">
          <p className="text-sm text-neutral-600">
            Cancel this payment? It will no longer count toward the booking balance.
          </p>
          <textarea
            value={cancelNotes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setCancelNotes(e.target.value)
            }
            placeholder="Add the cancellation reason"
            className="mt-2 h-16 w-full resize-none rounded-md border border-neutral-200 p-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            disabled={cancelMutation.isPending}
          />
        </div>
        <ModalFooter>
          <div className="flex w-full justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setCancelPaymentId(null)}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!cancelPaymentId) return;
                cancelMutation.mutate(
                  {
                    paymentId: cancelPaymentId,
                    data: { notes: cancelNotes || undefined },
                  },
                  { onSuccess: () => setCancelPaymentId(null) }
                );
              }}
              isLoading={cancelMutation.isPending}
            >
              Cancel payment
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
}
