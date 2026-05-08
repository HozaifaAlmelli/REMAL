import type { OwnerPortalBookingResponse } from "@/lib/types/owner-portal.types";
import { formatCurrency } from "@/lib/utils/format";

interface OwnerBookingDetailProps {
  booking: OwnerPortalBookingResponse;
}

export function OwnerBookingDetail({ booking }: OwnerBookingDetailProps) {
  const checkInDate = new Date(booking.checkInDate);
  const checkOutDate = new Date(booking.checkOutDate);
  const createdAt = new Date(booking.createdAt);
  const updatedAt = new Date(booking.updatedAt);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "completed":
        return "bg-green-100 text-green-700";
      case "booked":
      case "checkin":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
      case "notrelevant":
        return "bg-red-100 text-red-700";
      case "prospecting":
      case "relevant":
      case "noanswer":
      case "leftearly":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const nightCount = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      {/* Status badge */}
      <div>
        <span
          className={[
            "inline-flex rounded-full px-3 py-1.5 text-sm font-medium",
            getStatusColor(booking.bookingStatus),
          ].join(" ")}
        >
          {booking.bookingStatus}
        </span>
      </div>

      {/* Stay details */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Stay Details</h2>
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Check-in</dt>
            <dd className="font-medium text-neutral-900">
              {formatDate(checkInDate)}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Check-out</dt>
            <dd className="font-medium text-neutral-900">
              {formatDate(checkOutDate)}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Duration</dt>
            <dd className="font-medium text-neutral-900">
              {nightCount} {nightCount === 1 ? "night" : "nights"}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Guest Count</dt>
            <dd className="font-medium text-neutral-900">
              {booking.guestCount}{" "}
              {booking.guestCount === 1 ? "guest" : "guests"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Financial summary */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">
          Financial Summary
        </h2>
        <div className="mt-4">
          <p className="text-sm text-neutral-500">Final Amount</p>
          <p className="mt-1 text-3xl font-bold text-neutral-900">
            {formatCurrency(booking.finalAmount)}
          </p>
        </div>
      </div>

      {/* Booking metadata */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">
          Booking Information
        </h2>
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Booking ID</dt>
            <dd className="font-mono text-xs text-neutral-600">
              {booking.bookingId}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Unit ID</dt>
            <dd className="font-mono text-xs text-neutral-600">
              {booking.unitId}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Source</dt>
            <dd className="font-medium text-neutral-900">{booking.source}</dd>
          </div>
          {booking.assignedAdminUserId && (
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Assigned Admin</dt>
              <dd className="font-mono text-xs text-neutral-600">
                {booking.assignedAdminUserId}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Timestamps */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap gap-6 text-xs text-neutral-500">
          <div>
            <span className="font-medium">Created:</span>{" "}
            {formatDateTime(createdAt)}
          </div>
          <div>
            <span className="font-medium">Last Updated:</span>{" "}
            {formatDateTime(updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
