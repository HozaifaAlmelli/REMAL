import api from "@/lib/api/axios";
import { endpoints } from "@/lib/api/endpoints";
import type { CrmAssignmentResponse } from "@/lib/types/crm.types";
import type {
  BookingListFilters,
  PaginatedBookings,
  BookingDetailsResponse,
  ConfirmBookingRequest,
  CancelBookingRequest,
  CompleteBookingRequest,
  BookingStatusHistoryResponse,
  BookingNoteResponse,
  AddBookingNoteRequest,
  UpdateBookingNoteRequest,
  AssignBookingRequest,
  PaymentResponse,
  CreatePaymentRequest,
  MarkPaymentPaidRequest,
  MarkPaymentFailedRequest,
  CancelPaymentRequest,
  BookingFinanceSnapshotResponse,
  InvoiceResponse,
  InvoiceBalanceResponse,
  AddInvoiceManualAdjustmentRequest,
} from "@/lib/types/booking.types";

import type {
  PaymentListFilters,
  PaginatedPayments,
} from "@/lib/types/finance.types";

export const bookingsService = {
  // -- Bookings CRUD --
  getList: (filters?: BookingListFilters): Promise<PaginatedBookings> =>
    api.get(endpoints.internalBookings.list, { params: filters }),

  getById: (id: string): Promise<BookingDetailsResponse> =>
    api.get(endpoints.internalBookings.byId(id)),

  // -- Lifecycle --
  confirm: (
    id: string,
    data?: ConfirmBookingRequest
  ): Promise<BookingDetailsResponse> =>
    api.post(endpoints.bookingLifecycle.confirm(id), data ?? {}),

  cancel: (
    id: string,
    data?: CancelBookingRequest
  ): Promise<BookingDetailsResponse> =>
    api.post(endpoints.bookingLifecycle.cancel(id), data),

  complete: (
    id: string,
    data?: CompleteBookingRequest
  ): Promise<BookingDetailsResponse> =>
    api.post(endpoints.bookingLifecycle.complete(id), data ?? {}),

  checkIn: (
    bookingId: string,
    data?: { notes?: string }
  ): Promise<BookingDetailsResponse> =>
    api.post(endpoints.bookingLifecycle.checkIn(bookingId), data ?? {}),

  leftEarly: (
    bookingId: string,
    data?: { notes?: string }
  ): Promise<BookingDetailsResponse> =>
    api.post(endpoints.bookingLifecycle.leftEarly(bookingId), data ?? {}),

  // -- Status History --
  getStatusHistory: (id: string): Promise<BookingStatusHistoryResponse[]> =>
    api.get(endpoints.internalBookings.statusHistory(id)),

  // -- Notes --
  getNotes: (bookingId: string): Promise<BookingNoteResponse[]> =>
    api.get(endpoints.crmNotes.bookingNotesList(bookingId)),

  addNote: (
    bookingId: string,
    data: AddBookingNoteRequest
  ): Promise<BookingNoteResponse> =>
    api.post(endpoints.crmNotes.bookingNotesCreate(bookingId), data),

  updateNote: (
    noteId: string,
    data: UpdateBookingNoteRequest
  ): Promise<BookingNoteResponse> =>
    api.put(endpoints.crmNotes.update(noteId), data),

  deleteNote: (noteId: string): Promise<void> =>
    api.delete(endpoints.crmNotes.delete(noteId)),

  // -- Assignment --
  getAssignment: (bookingId: string): Promise<CrmAssignmentResponse> =>
    api.get(endpoints.crmAssignments.bookingGet(bookingId)),

  assign: (
    bookingId: string,
    data: AssignBookingRequest
  ): Promise<CrmAssignmentResponse> =>
    api.post(endpoints.crmAssignments.bookingSet(bookingId), data),

  unassign: (bookingId: string): Promise<void> =>
    api.delete(endpoints.crmAssignments.bookingDelete(bookingId)),

  // -- Payments --
  getPayments: (filters?: PaymentListFilters): Promise<PaginatedPayments> =>
    api.get(endpoints.payments.list, { params: filters }),

  createPayment: (data: CreatePaymentRequest): Promise<PaymentResponse> =>
    api.post(endpoints.payments.create, data),

  markPaid: (
    id: string,
    data?: MarkPaymentPaidRequest
  ): Promise<PaymentResponse> =>
    api.post(endpoints.payments.markPaid(id), data ?? {}),

  markFailed: (
    id: string,
    data: MarkPaymentFailedRequest
  ): Promise<PaymentResponse> =>
    api.post(endpoints.payments.markFailed(id), data),

  cancelPayment: (
    id: string,
    data?: CancelPaymentRequest
  ): Promise<PaymentResponse> =>
    api.post(endpoints.payments.cancel(id), data ?? {}),

  // -- Finance Snapshot --
  getFinanceSnapshot: (
    bookingId: string
  ): Promise<BookingFinanceSnapshotResponse> =>
    api.get(endpoints.financeSummary.bookingFinanceSnapshot(bookingId)),

  // -- Invoices --
  createInvoiceDraft: (data: {
    bookingId: string;
    invoiceNumber?: string;
    notes?: string;
  }): Promise<InvoiceResponse> =>
    api.post(endpoints.invoices.createDraft, data),

  getInvoiceById: (id: string): Promise<InvoiceResponse> =>
    api.get(endpoints.invoices.byId(id)),

  getInvoiceBalance: (id: string): Promise<InvoiceBalanceResponse> =>
    api.get(endpoints.invoices.balance(id)),

  issueInvoice: (id: string): Promise<InvoiceResponse> =>
    api.post(endpoints.invoices.issue(id)),

  cancelInvoice: (
    id: string,
    data?: { notes?: string }
  ): Promise<InvoiceResponse> => api.post(endpoints.invoices.cancel(id), data),

  addAdjustment: (
    id: string,
    data: AddInvoiceManualAdjustmentRequest
  ): Promise<InvoiceResponse> =>
    api.post(endpoints.invoices.addAdjustment(id), data),
};
