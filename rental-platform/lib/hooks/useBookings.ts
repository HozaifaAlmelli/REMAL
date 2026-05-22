import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { bookingsService } from "@/lib/api/services/bookings.service";
import { ApiError } from "@/lib/api/api-error";
import { queryKeys } from "@/lib/utils/query-keys";
import type {
  AddInvoiceManualAdjustmentRequest,
  AddBookingNoteRequest,
  UpdateBookingNoteRequest,
  AssignBookingRequest,
  BookingListFilters,
  ConfirmBookingRequest,
  CancelBookingRequest,
  CompleteBookingRequest,
  CreatePaymentRequest,
  MarkPaymentFailedRequest,
  CancelPaymentRequest,
} from "@/lib/types/booking.types";
import { toastSuccess, toastError } from "@/lib/utils/toast";

export function useBookingsList(filters: BookingListFilters) {
  return useQuery({
    queryKey: queryKeys.bookings.list(filters),
    queryFn: () => bookingsService.getList(filters),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useBookingDetail(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.detail(bookingId),
    queryFn: () => bookingsService.getById(bookingId),
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useBookingFinanceSnapshot(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.financeSnapshot(bookingId),
    queryFn: () => bookingsService.getFinanceSnapshot(bookingId),
    staleTime: 2000, // Consider data stale after 2 seconds (reduced from 30s)
    refetchInterval: 5000, // Auto-refetch every 5 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: false,
  });
}

export function useConfirmBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: ConfirmBookingRequest) =>
      bookingsService.confirm(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Booking confirmed - invoice generated");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useBookedBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string }) =>
      bookingsService.booked(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Booking marked as booked");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
    },
  });
}

export function useRelevantBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string }) =>
      bookingsService.relevant(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Booking marked as relevant");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
    },
  });
}

export function useNoAnswerBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string }) =>
      bookingsService.noAnswer(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Booking marked as no answer");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
    },
  });
}

export function useNotRelevantBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string }) =>
      bookingsService.notRelevant(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Booking marked as not relevant");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
    },
  });
}

export function useCancelBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: CancelBookingRequest) =>
      bookingsService.cancel(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Booking cancelled");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
    },
  });
}

export function useCompleteBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: CompleteBookingRequest) =>
      bookingsService.complete(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Booking completed");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
    },
  });
}

export function useCheckInBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string }) =>
      bookingsService.checkIn(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Client checked in");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
    },
  });
}

export function useLeftEarlyBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string }) =>
      bookingsService.leftEarly(bookingId, data),
    onSuccess: (updatedBooking) => {
      toastSuccess("Early departure recorded");
      queryClient.setQueryData(
        queryKeys.bookings.detail(bookingId),
        updatedBooking
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.statusHistory(bookingId),
      });
    },
  });
}

export function useBookingPayments(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.payments(bookingId),
    queryFn: () => bookingsService.getPayments({ bookingId }),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePaymentRequest) =>
      bookingsService.createPayment(data),
    onSuccess: (_, variables) => {
      toastSuccess("Payment recorded successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.payments(variables.bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.list({ bookingId: variables.bookingId }),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(variables.bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(variables.bookingId),
      });
    },
  });
}

export function useMarkPaymentPaid(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => bookingsService.markPaid(paymentId),
    onSuccess: () => {
      toastSuccess("Payment marked as paid");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.payments(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.list({ bookingId }),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(bookingId),
      });
    },
  });
}

export function useMarkPaymentFailed(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      data,
    }: {
      paymentId: string;
      data: MarkPaymentFailedRequest;
    }) => bookingsService.markFailed(paymentId, data),
    onSuccess: () => {
      toastSuccess("Payment marked as failed");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.payments(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.list({ bookingId }),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(bookingId),
      });
    },
  });
}

export function useCancelPayment(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      data,
    }: {
      paymentId: string;
      data?: CancelPaymentRequest;
    }) => bookingsService.cancelPayment(paymentId, data),
    onSuccess: () => {
      toastSuccess("Payment cancelled");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.payments(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.list({ bookingId }),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(bookingId),
      });
    },
  });
}

export function useLinkPaidPaymentsToInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bookingsService.linkPaidPaymentsToInvoices(),
    onSuccess: (data) => {
      toastSuccess(`Linked ${data.linkedPaymentsCount} payment(s) to invoices`);
      // Invalidate all finance-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.all,
      });
    },
  });
}

export function useInvoiceDetail(invoiceId: string | null) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(invoiceId!),
    queryFn: () => bookingsService.getInvoiceById(invoiceId!),
    enabled: !!invoiceId,
    refetchInterval: 5000, // Auto-refetch every 5 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: false,
  });
}

export function useCreateInvoiceDraft(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoiceNumber?: string; notes?: string }) =>
      bookingsService.createInvoiceDraft({
        bookingId,
        ...data,
      }),
    onSuccess: () => {
      toastSuccess("Invoice draft created successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useInvoiceBalance(invoiceId: string | null) {
  return useQuery({
    queryKey: queryKeys.invoices.balance(invoiceId!),
    queryFn: () => bookingsService.getInvoiceBalance(invoiceId!),
    enabled: !!invoiceId,
    refetchInterval: 5000, // Auto-refetch every 5 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: false,
  });
}

export function useIssueInvoice(invoiceId: string, bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bookingsService.issueInvoice(invoiceId),
    onSuccess: async (updatedInvoice) => {
      toastSuccess("Invoice issued successfully");

      // IMMEDIATELY update the cache with the response data
      // This ensures the UI updates instantly without waiting for refetch
      queryClient.setQueryData(
        queryKeys.invoices.detail(invoiceId),
        updatedInvoice
      );

      // Invalidate related queries to trigger background refetch
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.invoices.balance(invoiceId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.financeSnapshot(bookingId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.detail(bookingId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.invoices.all,
        }),
      ]);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        toastError(error.message || "Failed to issue invoice");
      } else {
        toastError("Failed to issue invoice. Please try again.");
      }
    },
  });
}

export function useCancelInvoice(invoiceId: string, bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string }) =>
      bookingsService.cancelInvoice(invoiceId, data),
    onSuccess: () => {
      toastSuccess("Invoice cancelled");
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.balance(invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(bookingId),
      });
    },
  });
}

export function useReissueInvoice(invoiceId: string, bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { newInvoiceNumber: string; notes?: string }) =>
      bookingsService.reissueInvoice(invoiceId, data),
    onSuccess: async (newInvoice) => {
      toastSuccess(
        "Invoice re-issued successfully. Old invoice marked as superseded."
      );

      // Invalidate the old invoice
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(invoiceId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.balance(invoiceId),
      });

      // Set the new invoice data immediately
      queryClient.setQueryData(
        queryKeys.invoices.detail(newInvoice.id),
        newInvoice
      );

      // Invalidate related queries and wait for refetch
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.financeSnapshot(bookingId),
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.detail(bookingId),
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.invoices.all,
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.all,
          refetchType: "active",
        }),
      ]);
    },
  });
}

export function useAddInvoiceAdjustment(invoiceId: string, bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddInvoiceManualAdjustmentRequest) =>
      bookingsService.addAdjustment(invoiceId, data),
    onSuccess: () => {
      toastSuccess("Adjustment added");
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.balance(invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.financeSnapshot(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(bookingId),
      });
    },
  });
}

// ── Notes ──
export function useBookingNotes(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.notes(bookingId),
    queryFn: () => bookingsService.getNotes(bookingId),
  });
}

export function useAddBookingNote(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddBookingNoteRequest) =>
      bookingsService.addNote(bookingId, data),
    onSuccess: () => {
      toastSuccess("Note added");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.notes(bookingId),
      });
    },
  });
}

export function useUpdateBookingNote(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      noteId,
      data,
    }: {
      noteId: string;
      data: UpdateBookingNoteRequest;
    }) => bookingsService.updateNote(noteId, data),
    onSuccess: () => {
      toastSuccess("Note updated");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.notes(bookingId),
      });
    },
  });
}

export function useDeleteBookingNote(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => bookingsService.deleteNote(noteId),
    onSuccess: () => {
      toastSuccess("Note deleted");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.notes(bookingId),
      });
    },
  });
}

// ── Assignment ──
export function useBookingAssignment(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.assignment(bookingId),
    queryFn: async () => {
      try {
        return await bookingsService.getAssignment(bookingId);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) {
          return null; // No assignment yet — treat as Unassigned
        }
        throw err;
      }
    },
    retry: false,
  });
}

// ── Status History ──
export function useBookingStatusHistory(bookingId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.statusHistory(bookingId),
    queryFn: () => bookingsService.getStatusHistory(bookingId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAssignBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignBookingRequest) =>
      bookingsService.assign(bookingId, data),
    onSuccess: () => {
      toastSuccess("Booking assigned");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.assignment(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
    },
  });
}

export function useUnassignBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bookingsService.unassign(bookingId),
    onSuccess: () => {
      toastSuccess("Booking unassigned");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.assignment(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
    },
  });
}
