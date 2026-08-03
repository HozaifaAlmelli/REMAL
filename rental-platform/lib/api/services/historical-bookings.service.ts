import api from "@/lib/api/axios";
import { endpoints } from "@/lib/api/endpoints";
import type {
  HistoricalBookingResponse,
  HistoricalOwnerAttributionReviewResponse,
  HistoricalPaymentResponse,
  RecordHistoricalBookingRequest,
  RecordHistoricalPaymentRequest,
} from "@/lib/types/historical-booking.types";

const idempotencyHeaders = (key: string) => ({
  headers: { "Idempotency-Key": key },
});

export const historicalBookingsService = {
  recordBooking: (
    request: RecordHistoricalBookingRequest,
    idempotencyKey: string
  ): Promise<HistoricalBookingResponse> =>
    api.post(
      endpoints.internalBookings.historical,
      request,
      idempotencyHeaders(idempotencyKey)
    ),

  reviewOwnerAttribution: (
    bookingId: string
  ): Promise<HistoricalOwnerAttributionReviewResponse> =>
    api.get(endpoints.internalBookings.ownerAttributionReview(bookingId)),

  recordPayment: (
    bookingId: string,
    request: RecordHistoricalPaymentRequest,
    idempotencyKey: string
  ): Promise<HistoricalPaymentResponse> =>
    api.post(
      endpoints.internalBookings.historicalPayments(bookingId),
      request,
      idempotencyHeaders(idempotencyKey)
    ),
};
