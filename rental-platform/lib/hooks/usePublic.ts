"use client";
import {
  useQuery,
  useMutation,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/react-query";
import { publicService } from "@/lib/api/services/public.service";
import { queryKeys } from "@/lib/utils/query-keys";
import type {
  PublicUnitFilters,
  PublicReviewFilters,
  PublicCreateCrmLeadRequest,
} from "@/lib/types/public.types";

// ═══════════════════════════════════════════
// QUERIES — Server data fetching
// ═══════════════════════════════════════════

// ── Areas ──
export function usePublicAreas() {
  return useQuery({
    queryKey: queryKeys.areas.all,
    queryFn: publicService.getAreas,
    staleTime: 5 * 60 * 1000, // 5 min — areas rarely change
  });
}

// ── Amenities ──
export function usePublicAmenities() {
  return useQuery({
    queryKey: queryKeys.amenities.all,
    queryFn: publicService.getAmenities,
    staleTime: 10 * 60 * 1000, // 10 min — amenities very rarely change
  });
}

// ── Units List (paginated) ──
export function usePublicUnits(filters?: PublicUnitFilters) {
  return useQuery({
    queryKey: queryKeys.units.publicList(filters),
    queryFn: () => publicService.getUnits(filters),
    placeholderData: keepPreviousData, // smooth pagination transitions
  });
}

// ── Unit Detail ──
export function usePublicUnit(id: string) {
  return useQuery({
    queryKey: queryKeys.units.publicById(id),
    queryFn: () => publicService.getUnitById(id),
    enabled: !!id,
  });
}

// Alias for consistency with ticket naming
export function usePublicUnitDetail(id: string) {
  return usePublicUnit(id);
}

// ── Unit Images ──
export function useUnitImages(unitId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.units.images(unitId),
    queryFn: () => publicService.getUnitImages(unitId),
    enabled: !!unitId && enabled,
  });
}

// Alias for consistency
export function usePublicUnitImages(unitId: string) {
  return useUnitImages(unitId);
}

// ── Unit Amenities ──
export function useUnitAmenities(unitId: string) {
  return useQuery({
    queryKey: queryKeys.units.amenities(unitId),
    queryFn: () => publicService.getUnitAmenities(unitId),
    enabled: !!unitId,
  });
}

// Alias for consistency
export function usePublicUnitAmenities(unitId: string) {
  return useUnitAmenities(unitId);
}

// ── Unit Reviews (paginated) ──
export function useUnitReviews(unitId: string, params?: PublicReviewFilters) {
  return useQuery({
    queryKey: queryKeys.publicReviews.byUnit(unitId, params),
    queryFn: () => publicService.getUnitReviews(unitId, params),
    enabled: !!unitId,
    placeholderData: keepPreviousData,
  });
}

// Alias for consistency
export function usePublicReviews(unitId: string, params?: PublicReviewFilters) {
  return useUnitReviews(unitId, params);
}

// ── Unit Review Summary ──
export function useUnitReviewSummary(unitId: string) {
  return useQuery({
    queryKey: queryKeys.publicReviews.summary(unitId),
    queryFn: () => publicService.getUnitReviewSummary(unitId),
    enabled: !!unitId,
  });
}

// Alias for consistency
export function usePublicReviewSummary(unitId: string) {
  return useUnitReviewSummary(unitId);
}

// ── Pricing Calculate (conditional — only when dates selected) ──
// ⚠️ P05: staleTime: 0 — pricing is time-sensitive
export function usePricingCalculate(
  unitId: string,
  startDate: string | null,
  endDate: string | null
) {
  return useQuery({
    queryKey: queryKeys.units.pricing(unitId, { startDate, endDate }),
    queryFn: () => publicService.calculatePricing(unitId, startDate!, endDate!),
    enabled: Boolean(unitId && startDate && endDate),
    staleTime: 0, // pricing is time-sensitive — always refetch
  });
}

// ── Availability Check (conditional — only when dates selected) ──
// ⚠️ P04: staleTime: 0 — availability is time-sensitive
export function useAvailabilityCheck(
  unitId: string,
  startDate: string | null,
  endDate: string | null
) {
  return useQuery({
    queryKey: queryKeys.units.availability(unitId, { startDate, endDate }),
    queryFn: () =>
      publicService.checkAvailability(unitId, startDate!, endDate!),
    enabled: Boolean(unitId && startDate && endDate),
    staleTime: 0, // availability is time-sensitive — always refetch
  });
}

// ═══════════════════════════════════════════
// MUTATIONS — On-demand actions
// ═══════════════════════════════════════════

// ── Availability Check ──
// Called when user selects dates on the booking form or calendar
export function useCheckAvailability() {
  return useMutation({
    mutationFn: ({
      unitId,
      startDate,
      endDate,
    }: {
      unitId: string;
      startDate: string;
      endDate: string;
    }) => publicService.checkAvailability(unitId, startDate, endDate),
  });
}

// ── Pricing Calculation ──
// Called after date selection to show nightly breakdown + total
export function useCalculatePricing() {
  return useMutation({
    mutationFn: ({
      unitId,
      startDate,
      endDate,
    }: {
      unitId: string;
      startDate: string;
      endDate: string;
    }) => publicService.calculatePricing(unitId, startDate, endDate),
  });
}

// ── Submit Booking Request (CRM Lead) ──
// Called when user submits the booking form — creates a CRM lead, NOT a formal booking
/**
 * Mutation hook for creating a CRM lead from the public booking form.
 *
 * Usage in FE-7-BOOK-03:
 * ```ts
 * const submitMutation = useSubmitBookingRequest()
 *
 * const handleSubmit = async () => {
 *   try {
 *     const result = await submitMutation.mutateAsync(leadRequest)
 *     router.push(`/booking-confirmation?id=${result.id}`)
 *   } catch (error) {
 *     // Error handled by component
 *   }
 * }
 * ```
 *
 * P06 corrections applied:
 * - targetUnitId (NOT unitId)
 * - desiredCheckInDate / desiredCheckOutDate (NOT checkInDate / checkOutDate)
 * - guestCount (NOT numberOfGuests)
 * - Response uses `id` (NOT leadId) and `leadStatus` (NOT status)
 */
export function useSubmitBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PublicCreateCrmLeadRequest) =>
      publicService.submitBookingRequest(data),

    onSuccess: (data) => {
      // Invalidate relevant queries after successful lead creation
      // Note: Client-side query keys for CRM are admin-only,
      // but we invalidate in case the user has admin access too
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clientBookings.all });

      // Also invalidate unit availability — the lead may affect availability
      if (data.targetUnitId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.units.availability(data.targetUnitId, {
            startDate: data.desiredCheckInDate,
            endDate: data.desiredCheckOutDate,
          }),
        });
      }
    },
  });
}
