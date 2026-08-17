import type { OwnerPortalBookingResponse } from "@/lib/types/owner-portal.types";
import { formatCurrency, referenceCode } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { HistoricalBadge } from "@/components/ui/HistoricalBadge";

interface OwnerBookingRowProps {
  booking: OwnerPortalBookingResponse;
  /** Resolved from the owner's units list; falls back to a reference if absent. */
  unitName?: string;
  onClick: () => void;
}

export function OwnerBookingRow({
  booking,
  unitName,
  onClick,
}: OwnerBookingRowProps) {
  const checkInDate = new Date(booking.checkInDate);
  const checkOutDate = new Date(booking.checkOutDate);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-neutral-200 transition-colors hover:bg-neutral-50"
    >
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col items-start gap-1">
          <span className="font-mono text-xs font-medium text-neutral-500">
            {referenceCode("BKG", booking.bookingId)}
          </span>
          {booking.isHistorical && <HistoricalBadge />}
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-neutral-900">
        {unitName ?? referenceCode("UNIT", booking.unitId)}
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
        <StatusBadge status={booking.bookingStatus} />
      </td>
      <td className="px-4 py-3 text-sm font-medium text-neutral-900">
        {formatCurrency(booking.finalAmount)}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-500">
        {booking.isHistorical ? "Recorded by KAZA admin" : booking.source}
      </td>
    </tr>
  );
}
