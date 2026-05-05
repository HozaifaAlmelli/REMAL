// ──────────────────────────────────────────────────────────────────────────────
// Owner Portal Service
// From REMAL_API_Reference.md Sections 34-39
// Owner Portal uses /api/owner/* endpoints (NOT /api/internal/*)
// ──────────────────────────────────────────────────────────────────────────────

import api from "../axios";
import { endpoints } from "../endpoints";
import type {
  OwnerPortalDashboardSummaryResponse,
  OwnerProfileResponse,
  OwnerPortalUnitResponse,
  PaginatedOwnerPortalUnits,
  OwnerPortalUnitListFilters,
  OwnerPortalBookingResponse,
  PaginatedOwnerPortalBookings,
  OwnerPortalBookingListFilters,
  PaginatedOwnerPortalFinanceRows,
  OwnerPortalFinanceListFilters,
  OwnerPortalFinanceSummaryResponse,
  ReviewReplyResponse,
  CreateReviewReplyRequest,
  UpdateReviewReplyRequest,
  OperationalAvailabilityRequest,
} from "@/lib/types/owner-portal.types";
import type { OperationalAvailabilityResponse } from "@/lib/types/unit.types";

// Transform params: camelCase to PascalCase for .NET API
function transformBookingFilters(
  f: OwnerPortalBookingListFilters
): Record<string, unknown> {
  if (!f) return {};
  return {
    ...(f.unitId && { UnitId: f.unitId }),
    ...(f.bookingStatus && { BookingStatus: f.bookingStatus.toLowerCase() }),
    ...(f.dateFrom && { CheckInFrom: f.dateFrom }),
    ...(f.dateTo && { CheckInTo: f.dateTo }),
    ...(f.page && { Page: f.page }),
    ...(f.pageSize && { PageSize: f.pageSize }),
  };
}

function transformFinanceFilters(
  f: OwnerPortalFinanceListFilters
): Record<string, unknown> {
  if (!f) return {};
  return {
    ...(f.invoiceStatus && { InvoiceStatus: f.invoiceStatus }),
    ...(f.payoutStatus && { PayoutStatus: f.payoutStatus }),
    ...(f.page && { Page: f.page }),
    ...(f.pageSize && { PageSize: f.pageSize }),
  };
}


export const ownerPortalService = {
  // ── Dashboard ──
  getDashboardSummary: (): Promise<OwnerPortalDashboardSummaryResponse> =>
    api.get(endpoints.ownerPortal.dashboard),

  // ── Profile ──
  // Backend gap: Endpoint not documented in API Reference
  getProfile: (): Promise<OwnerProfileResponse> =>
    api.get(endpoints.ownerPortal.profile),

  // ── Units ──
  getUnits: (
    filters?: OwnerPortalUnitListFilters
  ): Promise<PaginatedOwnerPortalUnits> =>
    api.get(endpoints.ownerPortal.units.list, { params: filters }),

  getUnitById: (unitId: string): Promise<OwnerPortalUnitResponse> =>
    api.get(endpoints.ownerPortal.units.detail(unitId)),

  // ── Unit Availability ──
  // Uses public endpoint (owner token accepted)
  // P04: Request uses startDate/endDate, response blockedDates is flat string array
  checkUnitAvailability: (
    unitId: string,
    data: OperationalAvailabilityRequest
  ): Promise<OperationalAvailabilityResponse> =>
    api.post(endpoints.units.operationalCheck(unitId), data),

  // ── Bookings ──
  getBookings: (
    filters?: OwnerPortalBookingListFilters
  ): Promise<PaginatedOwnerPortalBookings> =>
    api.get(endpoints.ownerPortal.bookings.list, {
      params: filters ? transformBookingFilters(filters) : undefined,
    }),

  getBookingById: (bookingId: string): Promise<OwnerPortalBookingResponse> =>
    api.get(endpoints.ownerPortal.bookings.detail(bookingId)),

  // ── Finance ──
  getFinanceRows: (
    filters?: OwnerPortalFinanceListFilters
  ): Promise<PaginatedOwnerPortalFinanceRows> =>
      api.get(endpoints.ownerPortal.finance.list, {
        params: filters ? transformFinanceFilters(filters) : undefined,
      }),

  getFinanceSummary: (): Promise<OwnerPortalFinanceSummaryResponse> =>
    api.get(endpoints.ownerPortal.finance.summary),

  // ── Review Replies ──
  createReviewReply: (
    reviewId: string,
    data: CreateReviewReplyRequest
  ): Promise<ReviewReplyResponse> =>
    api.post(endpoints.ownerPortal.reviews.createReply(reviewId), data),

  updateReviewReply: (
    reviewId: string,
    data: UpdateReviewReplyRequest
  ): Promise<ReviewReplyResponse> =>
    api.put(endpoints.ownerPortal.reviews.updateReply(reviewId), data),

  deleteReviewReply: (reviewId: string): Promise<void> =>
    api.delete(endpoints.ownerPortal.reviews.deleteReply(reviewId)),
};
