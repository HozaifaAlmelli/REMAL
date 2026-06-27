import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreatePayment, useMarkPaymentPaid } from "@/lib/hooks/useBookings";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants/payment-methods";
import { formatCurrency } from "@/lib/utils/format";
import { recordPaymentSchema } from "./schemas";
import type { CreatePaymentRequest } from "@/lib/types/booking.types";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  autoMarkPaid?: boolean;
  title?: string;
  submitLabel?: string;
  onSuccess?: () => void;
  // When provided, renders a tertiary action (e.g. "Skip & confirm") so recording a
  // payment is optional — used by the confirm flow where a deposit is not mandatory.
  onSkip?: () => void;
  skipLabel?: string;
  // Remaining balance owed on the booking. When provided, the modal shows the
  // remaining and blocks amounts that clearly exceed it (the backend is authoritative).
  remainingAmount?: number;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  bookingId,
  autoMarkPaid = false,
  title = "Record payment",
  submitLabel = "Record payment",
  onSuccess,
  onSkip,
  skipLabel = "Skip",
  remainingAmount,
}: RecordPaymentModalProps) {
  const createMutation = useCreatePayment();
  const markPaidMutation = useMarkPaymentPaid(bookingId);
  const isSubmitting = createMutation.isPending || markPaidMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
  } = useForm<CreatePaymentRequest>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      bookingId,
      paymentMethod: "Cash",
      amount: undefined as unknown as number, // Let the user type it
      referenceNumber: "",
      notes: "",
    },
  });

  const onSubmit = (data: CreatePaymentRequest) => {
    const referenceNumber = data.referenceNumber || undefined;
    const notes = data.notes || undefined;

    createMutation.mutate(
      {
        ...data,
        bookingId,  // always attach current booking
        referenceNumber,
        notes,
      },
      {
        onSuccess: (payment) => {
          const finish = () => {
            reset();
            onSuccess?.();
            onClose();
          };

          if (!autoMarkPaid) {
            finish();
            return;
          }

          markPaidMutation.mutate(
            {
              paymentId: payment.id,
              data: { referenceNumber, notes },
            },
            { onSuccess: finish }
          );
        },
      }
    );
  };

  const enteredAmount = watch("amount");
  const hasRemaining =
    typeof remainingAmount === "number" && Number.isFinite(remainingAmount);
  const exceedsRemaining =
    hasRemaining &&
    typeof enteredAmount === "number" &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > (remainingAmount as number);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
        {hasRemaining && (
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <span className="text-neutral-600">Remaining balance</span>
            <span className="tabular-nums font-semibold text-neutral-900">
              {formatCurrency(remainingAmount as number)}
            </span>
          </div>
        )}

        <Input
          label="Payment amount (EGP)"
          type="number"
          step="0.01"
          {...register("amount", { valueAsNumber: true })}
          error={errors.amount?.message}
          disabled={isSubmitting}
          required
        />

        {exceedsRemaining && (
          <p className="text-sm text-error">
            This amount exceeds the remaining balance of{" "}
            {formatCurrency(remainingAmount as number)}. Overpayments are not
            allowed.
          </p>
        )}

        <Controller
          name="paymentMethod"
          control={control}
          render={({ field }) => (
            <Select
              label="Payment method"
              options={PAYMENT_METHOD_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.paymentMethod?.message}
              disabled={isSubmitting}
              required
            />
          )}
        />

        <Input
          label="Receipt reference (optional)"
          {...register("referenceNumber")}
          error={errors.referenceNumber?.message}
          placeholder="InstaPay ref, transfer ID, etc."
          disabled={isSubmitting}
        />

        <div className="grid gap-1">
          <label className="text-sm font-medium text-neutral-700">Internal note (optional)</label>
          <textarea
            {...register("notes")}
            placeholder="Add payment context for the finance team"
            className="w-full border border-neutral-200 rounded-md p-2 text-sm resize-none h-20 focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 outline-none"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {onSkip && (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                reset();
                onSkip();
              }}
              disabled={isSubmitting}
            >
              {skipLabel}
            </Button>
          )}
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={exceedsRemaining}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}




