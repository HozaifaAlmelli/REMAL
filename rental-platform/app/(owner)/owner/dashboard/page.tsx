"use client";

import Link from "next/link";
import {
  useOwnerDashboardSummary,
  useOwnerBookings,
} from "@/lib/hooks/useOwnerPortal";
import { OwnerStatCard } from "@/components/owner/dashboard/OwnerStatCard";
import { UpcomingBookings } from "@/components/owner/dashboard/UpcomingBookings";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils/format";
import { ROUTES } from "@/lib/constants/routes";

export default function OwnerDashboardPage() {
  const { data, isLoading, error, refetch } = useOwnerDashboardSummary();

  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useOwnerBookings({
    bookingStatus: "Confirmed",
    pageSize: 3,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Dashboard
        </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Welcome to your property management portal
          </p>
        </div>

        {/* Skeleton stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-lg bg-neutral-200"
            />
          ))}
        </div>

        {/* Skeleton bookings */}
        <div className="space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-neutral-200" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-lg bg-neutral-200"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Dashboard
        </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Welcome to your property management portal
          </p>
        </div>

        <div className="rounded-lg border border-error/30 bg-error/5 p-6">
          <h2 className="text-lg font-semibold text-error">
            Failed to load dashboard
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            We could not load the owner dashboard summary.
          </p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Welcome to your property management portal
        </p>
      </div>

      {/* Stat cards */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <OwnerStatCard
            label="Units"
            value={`${data.activeUnits}/${data.totalUnits}`}
            subValue="Active / Total"
          />
          <OwnerStatCard
            label="Confirmed Bookings"
            value={data.confirmedBookings}
          />
          <OwnerStatCard
            label="Completed Bookings"
            value={data.completedBookings}
          />
          <OwnerStatCard
            label="Total Paid"
            value={formatCurrency(data.totalPaidAmount)}
          />
          <OwnerStatCard
            label="Pending Payout"
            value={formatCurrency(data.totalPendingPayoutAmount)}
          />
        </div>
      </section>

      {/* Upcoming bookings */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            Upcoming Bookings
          </h2>
          <Link
            href={ROUTES.owner.bookings}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            View all bookings
          </Link>
        </div>

        {bookingsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-lg bg-neutral-200"
              />
            ))}
          </div>
        ) : bookingsError ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
            Could not load upcoming bookings.
            <button
              type="button"
              onClick={() => refetchBookings()}
              className="ml-3 font-medium text-neutral-900 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <UpcomingBookings bookings={bookingsData?.items ?? []} />
        )}
      </section>

      {/* Quick links */}
      <section className="flex flex-wrap gap-3">
        <Link
          href={ROUTES.owner.bookings}
          className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
        >
          View all bookings
        </Link>
        <Link
          href={ROUTES.owner.finance}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          View finance
        </Link>
      </section>
    </div>
  );
}
