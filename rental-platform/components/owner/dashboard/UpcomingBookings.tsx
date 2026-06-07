import { format } from "date-fns";
import { Calendar, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { OwnerPortalBookingResponse } from "@/lib/types/owner-portal.types";

interface UpcomingBookingsProps {
  bookings: OwnerPortalBookingResponse[];
}

export function UpcomingBookings({ bookings }: UpcomingBookingsProps) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-neutral-900">
          No upcoming confirmed bookings
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Confirmed stays will appear here as they are booked.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <ul className="divide-y divide-neutral-200">
        {bookings.map((booking) => (
          <li
            key={booking.bookingId}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              {/* unitId only: the owner bookings API does not return a unit name yet */}
              <p className="truncate text-sm font-medium text-neutral-900">
                Unit{" "}
                <span className="font-mono text-xs text-neutral-500">
                  {booking.unitId.slice(0, 8)}
                </span>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 flex-none text-neutral-400" />
                  <span className="tabular-nums">
                    {format(new Date(booking.checkInDate), "MMM dd")} to{" "}
                    {format(new Date(booking.checkOutDate), "MMM dd, yyyy")}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 flex-none text-neutral-400" />
                  <span className="tabular-nums">{booking.guestCount}</span>{" "}
                  guest{booking.guestCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <StatusBadge status={booking.bookingStatus} />
          </li>
        ))}
      </ul>
    </div>
  );
}
