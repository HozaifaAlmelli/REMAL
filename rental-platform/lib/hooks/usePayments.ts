import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsService } from "@/lib/api/services/payments.service";
import { queryKeys } from "@/lib/utils/query-keys";
import { toastSuccess, toastError } from "@/lib/utils/toast";
import { ApiError } from "@/lib/api/api-error";
import type { PaymentListFilters } from "@/lib/types/finance.types";
import type {
  MarkPaymentFailedRequest,
  CancelPaymentRequest,
} from "@/lib/types/booking.types";

export function usePaymentsList(filters?: PaymentListFilters) {
  return useQuery({
    queryKey: queryKeys.payments.list(filters),
    queryFn: () => paymentsService.getAll(filters),
    refetchInterval: 5000, // Auto-refetch every 5 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: false,
  });
}

export function usePaymentDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => paymentsService.getById(id),
    enabled: !!id,
  });
}

export function useMarkPaymentPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentsService.markPaid(id),
    onSuccess: async () => {
      console.log(
        "[useMarkPaymentPaid] Payment marked as paid, invalidating queries..."
      );
      toastSuccess("Payment marked as paid successfully");
      // Invalidate all related queries and force refetch
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.all,
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.all,
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.invoices.all,
          refetchType: "active",
        }),
      ]);
      console.log("[useMarkPaymentPaid] All queries invalidated and refetched");
    },
    onError: (error: unknown) => {
      console.error("[useMarkPaymentPaid] Error:", error);
      if (error instanceof ApiError) {
        toastError(error.message || "Failed to mark payment as paid");
      } else {
        toastError("Failed to mark payment as paid. Please try again.");
      }
    },
  });
}

export function useMarkPaymentFailed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: MarkPaymentFailedRequest;
    }) => paymentsService.markFailed(id, data),
    onSuccess: () => {
      toastSuccess("Payment marked as failed");
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        toastError(error.message || "Failed to mark payment as failed");
      } else {
        toastError("Failed to mark payment as failed. Please try again.");
      }
    },
  });
}

export function useCancelPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CancelPaymentRequest }) =>
      paymentsService.cancel(id, data),
    onSuccess: () => {
      toastSuccess("Payment cancelled successfully");
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        toastError(error.message || "Failed to cancel payment");
      } else {
        toastError("Failed to cancel payment. Please try again.");
      }
    },
  });
}

export function useLinkPaidPaymentsToInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => paymentsService.linkPaidToInvoices(),
    onSuccess: async (data) => {
      console.log(
        `[useLinkPaidPaymentsToInvoices] Linked ${data.linkedPaymentsCount} payments`
      );
      toastSuccess(
        `Successfully linked ${data.linkedPaymentsCount} payment(s) to invoices`
      );
      // Invalidate all related queries and force refetch
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.all,
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.all,
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.invoices.all,
          refetchType: "active",
        }),
      ]);
      console.log(
        "[useLinkPaidPaymentsToInvoices] All queries invalidated and refetched"
      );
    },
    onError: (error: unknown) => {
      console.error("[useLinkPaidPaymentsToInvoices] Error:", error);
      if (error instanceof ApiError) {
        toastError(error.message || "Failed to link payments to invoices");
      } else {
        toastError("Failed to link payments to invoices. Please try again.");
      }
    },
  });
}
