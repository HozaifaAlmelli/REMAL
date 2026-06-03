"use client";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { useClientBookings } from "@/lib/hooks/useClient";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { CalendarCheck, Home } from "lucide-react";
import Link from "next/link";

export default function ClientBookingsPage() {
  const { data, isLoading, isError } = useClientBookings({
    page: 1,
    pageSize: 20,
  });
  const bookings = data?.items ?? [];
  console.log("CLIENT BOOKINGS FETCHED:", data);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-neutral-900">
          My Bookings
        </h1>
      </div>

      {isLoading && <SkeletonTable rows={5} columns={6} />}

      {isError && (
        <EmptyState
          title="Bookings could not load"
          description="Refresh the page or try again after a moment."
          icon={<CalendarCheck className="h-12 w-12" />}
        />
      )}

      {!isLoading && !isError && bookings.length === 0 && (
        <EmptyState
          title="No bookings yet"
          description="When you submit booking requests, they'll appear here so you can track their status."
          icon={<CalendarCheck className="h-12 w-12" />}
          action={
            <Link href="/units">
              <Button>Browse Properties</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !isError && bookings.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="p-4 font-medium">Property</th>
                  <th className="p-4 font-medium">Dates</th>
                  <th className="p-4 font-medium">Guests</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-neutral-50">
                    <td className="p-4 font-medium text-neutral-900">
                      {booking.unitName ?? "Property"}
                    </td>
                    <td className="p-4 text-neutral-600">
                      {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
                    </td>
                    <td className="p-4 text-neutral-600">{booking.guestCount}</td>
                    <td className="p-4 font-medium text-neutral-900">
                      {formatCurrency(booking.finalAmount)}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={booking.bookingStatus} />
                    </td>
                    <td className="p-4 text-neutral-500">
                      {formatDate(booking.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-xl border border-neutral-100 bg-white p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <Home className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="truncate">{booking.unitName ?? "Property"}</span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-600">
                      {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
                    </p>
                  </div>
                  <StatusBadge status={booking.bookingStatus} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-neutral-500">Guests</p>
                    <p className="font-medium text-neutral-900">{booking.guestCount}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Total</p>
                    <p className="font-medium text-neutral-900">
                      {formatCurrency(booking.finalAmount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
