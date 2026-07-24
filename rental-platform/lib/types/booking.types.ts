// ═══════════════════════════════════════════════════════════
// lib/types/booking.types.ts
// Booking form types — shared across multi-step form
// AND admin booking management types
// ═══════════════════════════════════════════════════════════

// ──────────── PUBLIC BOOKING FORM TYPES ────────────

export type BookingStep = 1 | 2 | 3;

export interface BookingFormData {
  // Step 1 — Booking Details
  startDate: string | null; // ISO date: "2026-06-01" — NOT 'checkInDate' per P04/P05
  endDate: string | null; // ISO date: "2026-06-05" — NOT 'checkOutDate' per P04/P05
  guestCount: number;

  // Step 2 — Contact (populated by FE-7-BOOK-02)
  clientId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string | null;

  // Step 3 — Submission (handled by FE-7-BOOK-03/04)
}

// ──────────── ADMIN BOOKING MANAGEMENT TYPES ────────────
// Placeholder types for admin booking management
// These will be properly defined when admin booking features are implemented

export type FormalBookingStatus =
  | "Prospecting"
  | "Relevant"
  | "NoAnswer"
  | "NotRelevant"
  | "Booked"
  | "Confirmed"
  | "CheckIn"
  | "Completed"
  | "Cancelled"
  | "LeftEarly";

export type InvoiceStatus =
  | "Draft"
  | "Issued"
  | "Paid"
  | "Cancelled"
  | "Superseded";

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export interface BookingListFilters {
  page?: number;
  pageSize?: number;
  bookingStatus?: FormalBookingStatus;
  unitId?: string;
  clientId?: string;
  ownerId?: string;
  assignedAdminUserId?: string;
  checkInFrom?: string;
  checkInTo?: string;
  search?: string;
  agedSoftHoldsOnly?: boolean;
}

export interface CreateBookingRequest {
  clientId: string;
  unitId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  source: "direct" | "admin" | "phone" | "whatsapp" | "website";
  assignedAdminUserId?: string;
  internalNotes?: string;
}

// Client-portal booking request — client comes from the auth token, so no clientId.
export interface CreateClientBookingRequest {
  unitId: string;
  checkInDate: string; // yyyy-MM-dd
  checkOutDate: string; // yyyy-MM-dd
  guestCount: number;
}

export interface PaginatedBookings {
  items: BookingListItemResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface BookingListItemResponse {
  id: string;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  unitId: string;
  unitName: string | null;
  ownerId: string;
  assignedAdminUserId: string | null;
  assignedAdminUserName: string | null;
  assignedAdminUserRole: string | null;
  bookingStatus: FormalBookingStatus;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  baseAmount: number;
  finalAmount: number;
  source: string;
  createdAt: string;
  isAgedSoftHold: boolean;
  softHoldAgeDays: number | null;
}

export interface BookingDetailsResponse {
  id: string;
  clientId: string;
  unitId: string;
  unitName: string | null;
  ownerId: string;
  assignedAdminUserId: string | null;
  assignedAdminUserName: string | null;
  assignedAdminUserRole: string | null;
  bookingStatus: FormalBookingStatus;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  baseAmount: number;
  finalAmount: number;
  source: string;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  isAgedSoftHold: boolean;
  softHoldAgeDays: number | null;
}

export interface ConfirmBookingRequest {
  notes?: string;
}

export interface CancelBookingRequest {
  notes?: string;
}

export interface CompleteBookingRequest {
  notes?: string;
}

export interface CheckInBookingRequest {
  notes?: string;
}

export interface LeftEarlyBookingRequest {
  notes?: string;
}

export interface BookingStatusHistoryResponse {
  id: string;
  bookingId: string;
  oldStatus: FormalBookingStatus | null;
  newStatus: FormalBookingStatus;
  changedByAdminUserId: string | null;
  actorDisplayName: string;
  actorType: "admin" | "online" | "system" | "unavailable";
  notes: string | null;
  changedAt: string;
}

export interface BookingNoteResponse {
  id: string;
  bookingId: string;
  crmLeadId: string | null;
  createdByAdminUserId: string;
  noteText: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddBookingNoteRequest {
  noteText: string;
}

export interface UpdateBookingNoteRequest {
  noteText: string;
}

export interface AssignBookingRequest {
  assignedAdminUserId: string;
}

export interface PaymentResponse {
  id: string;
  bookingId: string;
  invoiceId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  paymentStatus: string;
  paymentMethod: string;
  amount: number;
  referenceNumber: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  bookingId: string;
  invoiceId?: string;
  paymentMethod: string;
  amount: number;
  referenceNumber?: string;
  notes?: string;
}

export interface MarkPaymentPaidRequest {
  referenceNumber?: string;
  notes?: string;
}

export interface MarkPaymentFailedRequest {
  notes?: string;
}

export interface CancelPaymentRequest {
  notes?: string;
}

export interface BookingFinanceSnapshotResponse {
  bookingId: string;
  remainingAmount: number;
  invoicedAmount: number;
  paidAmount: number;
  invoiceId?: string | null;
  invoiceStatus?: string | null;
  ownerPayoutStatus?: string | null;
}

export interface InvoiceItemResponse {
  id: string;
  invoiceId: string;
  lineType: string;
  description: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceResponse {
  id: string;
  bookingId: string;
  invoiceNumber: string;
  subtotalAmount: number;
  totalAmount: number;
  invoiceStatus: string;
  issuedAt: string | null;
  dueDate: string | null;
  notes: string | null;
  items?: InvoiceItemResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceBalanceResponse {
  invoiceId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isFullyPaid: boolean;
}

export interface AddInvoiceManualAdjustmentRequest {
  description: string;
  quantity: number;
  unitAmount: number;
}
