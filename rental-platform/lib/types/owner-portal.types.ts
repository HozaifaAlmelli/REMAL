// ──────────────────────────────────────────────────────────────────────────────
// Owner Portal Types
// From KAZA_BOOKING_API_Reference.md Sections 34-39
// Owner Portal uses /api/owner/* endpoints (NOT /api/internal/*)
// ──────────────────────────────────────────────────────────────────────────────

import type { PaginationMeta } from "./common.types";

// ── Dashboard Summary ──
// From API Reference Section 34
export interface OwnerPortalDashboardSummaryResponse {
  ownerId: string;
  totalUnits: number;
  activeUnits: number;
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  totalPaidAmount: number;
  totalPendingPayoutAmount: number;
  totalPaidPayoutAmount: number;
}

// ── Profile ──
// Backend gap: Not documented in API Reference
// Assumed response shape for GET /api/owner/profile
export interface OwnerProfileResponse {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  commissionRate: number; // e.g., 20.00 means 20%. Display as "20%" per P16
  status: "active" | "inactive";
}

// ── Unit ──
// From API Reference Section 35
export interface OwnerPortalUnitResponse {
  unitId: string;
  projectId: string;
  unitName: string;
  unitType: string;
  isActive: boolean;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePricePerNight: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedOwnerPortalUnits {
  items: OwnerPortalUnitResponse[];
  pagination: PaginationMeta;
}

export interface OwnerPortalUnitListFilters {
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

// ── Booking ──
// From API Reference Section 36
export interface OwnerPortalBookingResponse {
  bookingId: string;
  unitId: string;
  clientId: string;
  assignedAdminUserId: string | null;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  bookingStatus: string;
  finalAmount: number;
  source: string;
  isHistorical: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedOwnerPortalBookings {
  items: OwnerPortalBookingResponse[];
  pagination: PaginationMeta;
}

export interface OwnerPortalBookingListFilters {
  unitId?: string;
  bookingStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

// ── Finance ──
// From API Reference Section 37
export interface OwnerPortalFinanceRowResponse {
  bookingId: string;
  unitId: string;
  unitName: string;
  clientName: string;
  invoiceId: string;
  invoiceStatus: string;
  invoicedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payoutId: string | null;
  payoutStatus: string | null;
  payoutAmount: number | null;
  payoutScheduledAt: string | null;
  payoutPaidAt: string | null;
}

export interface PaginatedOwnerPortalFinanceRows {
  items: OwnerPortalFinanceRowResponse[];
  pagination: PaginationMeta;
}

export interface OwnerPortalFinanceListFilters {
  unitId?: string;
  invoiceStatus?: string;
  payoutStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface OwnerPortalFinanceSummaryResponse {
  ownerId: string;
  totalInvoicedAmount: number;
  totalPaidAmount: number;
  totalRemainingAmount: number;
  totalPendingPayoutAmount: number;
  totalScheduledPayoutAmount: number;
  totalPaidPayoutAmount: number;
}

// ── Review Reply ──
// From API Reference Section 38
export interface ReviewReplyResponse {
  id: string;
  reviewId: string;
  ownerId: string;
  replyText: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewReplyRequest {
  replyText: string;
}

export interface UpdateReviewReplyRequest {
  replyText: string;
}

// ── Notifications ──
// Owner notifications use the same types as admin notifications
// but accessed via /api/owner/notifications/* endpoints
// Types are imported from notification.types.ts

// ── Unit Availability ──
// P04 corrected: Uses startDate/endDate (NOT checkInDate/checkOutDate)
// blockedDates is a FLAT STRING ARRAY (NOT objects)
// Note: OperationalAvailabilityResponse is imported from unit.types.ts
export interface OperationalAvailabilityRequest {
  startDate: string; // CORRECT per P04 (NOT checkInDate)
  endDate: string; // CORRECT per P04 (NOT checkOutDate)
}
