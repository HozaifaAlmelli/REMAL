import { useState } from "react";
import {
  useBookingPayments,
  useMarkPaymentPaid,
  useMarkPaymentFailed,
  useCancelPayment,
} from "@/lib/hooks/useBookings";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment-methods";
import { CreditCard } from "lucide-react";

interface BookingPaymentsProps {
  bookingId: string;
}

export function BookingPayments({ bookingId }: BookingPaymentsProps) {
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [failedPaymentId, setFailedPaymentId] = useState<string | null>(null);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [failedNotes, setFailedNotes] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  const { data: payments, isLoading } = useBookingPayments(bookingId);
  const markPaidMutation = useMarkPaymentPaid(bookingId);
  const markFailedMutation = useMarkPaymentFailed(bookingId);
  const cancelMutation = useCancelPayment(bookingId);

  const { canManageFinance, canManageBookings } = usePermissions();
  const canRecordPayment = canManageFinance || canManageBookings;

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Payments</h3>
        {canRecordPayment && (
          <Button size="sm" onClick={() => setShowRecordModal(true)}>
            Record Payment
          </Button>
        )}
      </div>

      {!payments || payments.items.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title="No payments recorded"
          description="Record the first payment for this booking"
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
                payment.paymentStatus.toLowerCase() === "pending" && (
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
                      Mark Paid
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setFailedPaymentId(payment.id);
                        setFailedNotes("");
                      }}
                    >
                      Mark Failed
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

              {/* Debug: Show payment status */}
              <div className="ml-2 text-xs text-blue-600">
                Status: &quot;{payment.paymentStatus}&quot;
              </div>
            </div>
          ))}
        </div>
      )}

      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        bookingId={bookingId}
      />

      {/* Mark Failed Dialog */}
      <Modal
        isOpen={!!failedPaymentId}
        onClose={() => setFailedPaymentId(null)}
        title="Mark Payment as Failed"
        size="sm"
      >
        <div className="space-y-4 py-4">
          <p className="text-sm text-neutral-600">
            Are you sure you want to mark this payment as failed?
          </p>
          <textarea
            value={failedNotes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFailedNotes(e.target.value)
            }
            placeholder="Reason for failure (optional)"
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
              Mark Failed
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Cancel Payment Dialog */}
      <Modal
        isOpen={!!cancelPaymentId}
        onClose={() => setCancelPaymentId(null)}
        title="Cancel Payment"
        size="sm"
      >
        <div className="space-y-4 py-4">
          <p className="text-sm text-neutral-600">
            Are you sure you want to cancel this payment?
          </p>
          <textarea
            value={cancelNotes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setCancelNotes(e.target.value)
            }
            placeholder="Cancellation reason (optional)"
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
              Cancel Payment
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
}
