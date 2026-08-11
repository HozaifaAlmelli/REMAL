import { useInternalUnitDetail } from "@/lib/hooks/useUnits";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate, getNights } from "@/lib/utils/format";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import { ArrowLeft } from "lucide-react";
import type { BookingDetailsResponse } from "@/lib/types/booking.types";
import { HistoricalBadge } from "@/components/ui/HistoricalBadge";

interface BookingHeaderProps {
  booking: BookingDetailsResponse;
}

export function BookingHeader({ booking }: BookingHeaderProps) {
  const { data: unit, isLoading: isUnitLoading } = useInternalUnitDetail(
    booking.unitId
  );
  const nights = getNights(booking.checkInDate, booking.checkOutDate);

  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.admin.bookings.list}
        className="inline-flex items-center text-sm font-medium text-neutral-500 transition hover:text-neutral-700"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Bookings
      </Link>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900">
              Booking {booking?.id?.split("-")[0]?.toUpperCase()}
            </h1>
            <StatusBadge status={booking.bookingStatus} />
            {booking.isHistorical && <HistoricalBadge />}
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
              KAZA channel: {booking.source}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-500">
            <div>
              {formatDate(booking.checkInDate)} —{" "}
              {formatDate(booking.checkOutDate)}
              <span className="mx-2 text-neutral-300">•</span>
              {nights} night{nights !== 1 ? "s" : ""}
            </div>

            {isUnitLoading ? (
              <div className="flex items-center">
                <span className="mx-2 hidden text-neutral-300 md:inline">
                  |
                </span>
                <Skeleton className="h-4 w-32" />
              </div>
            ) : unit ? (
              <div className="flex items-center">
                <span className="mx-2 hidden text-neutral-300 md:inline">
                  |
                </span>
                <Link
                  href={ROUTES.admin.units.detail(unit.id)}
                  className="mr-2 font-medium text-neutral-700 hover:text-black hover:underline"
                >
                  Unit {unit.name}
                </Link>
                <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-[2px] text-xs">
                  {unit.unitType}
                </span>
                <span className="ml-2 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-[2px] text-xs text-neutral-600">
                  {unit.projectName ?? "Unassigned project"}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
