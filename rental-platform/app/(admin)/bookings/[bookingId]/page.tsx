"use client";

import { useParams } from "next/navigation";
import {
  useBookingDetail,
  useBookingFinanceSnapshot,
} from "@/lib/hooks/useBookings";
import { useInternalUnitDetail } from "@/lib/hooks/useUnits";
import { BookingHeader } from "@/components/admin/bookings/BookingHeader";
import { BookingClientInfo } from "@/components/admin/bookings/BookingClientInfo";
import { BookingFinancialSummary } from "@/components/admin/bookings/BookingFinancialSummary";
import { BookingLifecycleActions } from "@/components/admin/bookings/BookingLifecycleActions";
import { BookingPayments } from "@/components/admin/bookings/BookingPayments";
import { BookingInvoice } from "@/components/admin/bookings/BookingInvoice";
import { BookingNotes } from "@/components/admin/bookings/BookingNotes";
import { BookingAssignment } from "@/components/admin/bookings/BookingAssignment";
import { BookingStatusHistory } from "@/components/admin/bookings/BookingStatusHistory";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileQuestion, AlertCircle } from "lucide-react";
import { ROUTES } from "@/lib/constants/routes";
import { ApiError } from "@/lib/api/api-error";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const {
    data: booking,
    isLoading,
    isError,
    error,
  } = useBookingDetail(bookingId as string);
  const { data: snapshot, isLoading: snapshotLoading } =
    useBookingFinanceSnapshot(bookingId as string);
  const { data: unit, isLoading: isUnitLoading } = useInternalUnitDetail(
    booking?.unitId || ""
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    const isNotFound = error instanceof ApiError && error.status === 404;

    if (isNotFound) {
      return (
        <EmptyState
          icon={<FileQuestion className="h-12 w-12" />}
          title="Booking not found"
          description="This booking may have been removed or the ID is incorrect"
          action={
            <Link
              href={ROUTES.admin.bookings.list}
              className={cn(
                "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
                "bg-blue-600 text-white hover:bg-blue-700",
                "h-10 px-4 py-2"
              )}
            >
              Back to Bookings
            </Link>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<AlertCircle className="h-12 w-12" />}
        title="Could not load booking"
        description="An error occurred while fetching booking details"
      />
    );
  }

  if (!booking) return null;

  return (
    <div className="space-y-6">
      <BookingHeader booking={booking} />

      {/* Booking Details Card - Prominent Display */}
      <div className="rounded-lg border-2 border-primary-200 bg-gradient-to-br from-white to-primary-50 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-neutral-800">
          📋 Booking Details
        </h2>
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <span className="font-medium text-neutral-600">Status:</span>
            <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-700">
              {booking.bookingStatus}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <span className="font-medium text-neutral-600">Unit:</span>
            {isUnitLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : unit ? (
              <span className="font-semibold text-neutral-800">
                {unit.name} ({unit.unitType})
              </span>
            ) : (
              <span className="text-neutral-400">Loading...</span>
            )}
          </div>
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <span className="font-medium text-neutral-600">Check-in:</span>
            <span className="font-semibold text-neutral-800">
              {new Date(booking.checkInDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <span className="font-medium text-neutral-600">Check-out:</span>
            <span className="font-semibold text-neutral-800">
              {new Date(booking.checkOutDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-600">Amount:</span>
            <span className="text-lg font-bold text-primary-600">
              {booking.finalAmount?.toLocaleString() || "0"} EGP
            </span>
          </div>
        </div>
      </div>

      {/* Lifecycle Actions - Prominent Display */}
      <div className="space-y-4 rounded-lg border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-800">
          🎯 LIFECYCLE ACTIONS
        </h2>
        <BookingLifecycleActions
          bookingId={booking.id}
          currentStatus={booking.bookingStatus}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BookingClientInfo clientId={booking.clientId} />
        {snapshotLoading ? (
          <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-neutral-700">
              Financial Summary
            </h3>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : snapshot ? (
          <BookingFinancialSummary snapshot={snapshot} />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-4 text-sm text-red-500">
            Financial data unavailable
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <BookingPayments bookingId={booking.id} />
      </div>

      {/* Invoice */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <BookingInvoice
          bookingId={booking.id}
          invoiceId={snapshot?.invoiceId || null}
        />
      </div>

      {/* Notes & Assignment */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <BookingNotes bookingId={booking.id} />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <BookingAssignment bookingId={booking.id} />
        </div>
      </div>

      {/* Status History */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <BookingStatusHistory bookingId={booking.id} />
      </div>
    </div>
  );
}
