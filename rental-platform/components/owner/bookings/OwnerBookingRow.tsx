import type { OwnerPortalBookingResponse } from "@/lib/types/owner-portal.types";
import { formatCurrency } from "@/lib/utils/format";

interface OwnerBookingRowProps {
  booking: OwnerPortalBookingResponse;
  onClick: () => void;
}

export function OwnerBookingRow({ booking, onClick }: OwnerBookingRowProps) {
  const checkInDate = new Date(booking.checkInDate);
  const checkOutDate = new Date(booking.checkOutDate);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-neutral-200 transition-colors hover:bg-neutral-50"
    >
      <td className="px-4 py-3 text-sm">
        <span className="font-mono text-xs text-neutral-600">
          {booking.bookingId.slice(0, 8)}...
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <span className="font-mono text-xs text-neutral-600">
          {booking.unitId.slice(0, 8)}...
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-900">
        {formatDate(checkInDate)}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-900">
        {formatDate(checkOutDate)}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-900">
        {booking.guestCount}
      </td>
      <td className="px-4 py-3">
        <span
          className={[
            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
            getStatusColor(booking.bookingStatus),
          ].join(" ")}
        >
          {booking.bookingStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-neutral-900">
        {formatCurrency(booking.finalAmount)}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-500">{booking.source}</td>
    </tr>
  );
}
