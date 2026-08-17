import type { BookingDetailsResponse } from "@/lib/types/booking.types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  formatHistoricalEntryReason,
  formatHistoricalProvenance,
} from "@/lib/historical-reporting/presentation";
import { FileClock } from "lucide-react";

export function HistoricalBookingContext({
  booking,
}: {
  booking: BookingDetailsResponse;
}) {
  if (!booking.isHistorical) return null;

  return (
    <section
      className="border-y border-amber-200 bg-amber-50/70 px-4 py-4"
      aria-labelledby="historical-booking-context-title"
    >
      <div className="flex items-start gap-3">
        <FileClock className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2
            id="historical-booking-context-title"
            className="text-sm font-semibold text-amber-950"
          >
            Historical Booking context
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-amber-900">
            This stay happened outside KAZA and was recorded later. Recorded date and original booking date are intentionally different.
          </p>
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-amber-800">Recorded date</dt>
              <dd className="mt-0.5 text-sm font-semibold text-amber-950">
                {formatDate(booking.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-amber-800">Actual booked date</dt>
              <dd className="mt-0.5 text-sm font-semibold text-amber-950">
                {booking.actualBookedAt ? formatDate(booking.actualBookedAt) : "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-amber-800">Original source</dt>
              <dd className="mt-0.5 text-sm font-semibold text-amber-950">
                {formatHistoricalProvenance(booking.originalSource)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-amber-800">Historical agreed value</dt>
              <dd className="mt-0.5 text-sm font-semibold text-amber-950">
                {booking.agreedAmount == null
                  ? "Not provided"
                  : formatCurrency(booking.agreedAmount)}
              </dd>
            </div>
            <div className="sm:col-span-2 xl:col-span-4">
              <dt className="text-xs font-medium text-amber-800">Entry reason</dt>
              <dd className="mt-0.5 text-sm font-semibold text-amber-950">
                {formatHistoricalEntryReason(booking.historicalEntryReason)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
