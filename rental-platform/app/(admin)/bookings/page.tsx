"use client";

import { Suspense, useMemo, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useBookingsList } from "@/lib/hooks/useBookings";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { BookingFilters } from "@/components/admin/bookings/BookingFilters";
import { BookingTable } from "@/components/admin/bookings/BookingTable";
import { QuickBookingModal } from "@/components/admin/bookings/QuickBookingModal";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants/routes";
import { FormalBookingStatus, BookingListFilters } from "@/lib/types/booking.types";
import { Plus } from "lucide-react";

function BookingsListContent() {
  const { canViewBookings, canManageBookings } = usePermissions();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);

  useEffect(() => {
    if (!canViewBookings) {
      router.replace(ROUTES.admin.dashboard);
    }
  }, [canViewBookings, router]);

  const filters = useMemo<BookingListFilters>(() => ({
    bookingStatus: (searchParams.get("bookingStatus") as FormalBookingStatus) || undefined,
    assignedAdminUserId: searchParams.get("assignedAdminUserId") || undefined,
    checkInFrom: searchParams.get("checkInFrom") || undefined,
    checkInTo: searchParams.get("checkInTo") || undefined,
    search: searchParams.get("search") || undefined,
    agedSoftHoldsOnly: searchParams.get("agedSoftHoldsOnly") === "true" || undefined,
    page: Number(searchParams.get("page")) || 1,
    pageSize: 20,
  }), [searchParams]);

  const { data, isLoading } = useBookingsList(filters);

  const handleFilterChange = (newFilters: BookingListFilters) => {
    const params = new URLSearchParams();
    if (newFilters.bookingStatus) params.set("bookingStatus", newFilters.bookingStatus);
    if (newFilters.assignedAdminUserId) params.set("assignedAdminUserId", newFilters.assignedAdminUserId);
    if (newFilters.checkInFrom) params.set("checkInFrom", newFilters.checkInFrom);
    if (newFilters.checkInTo) params.set("checkInTo", newFilters.checkInTo);
    if (newFilters.search) params.set("search", newFilters.search);
    if (newFilters.agedSoftHoldsOnly) params.set("agedSoftHoldsOnly", "true");
    if (newFilters.page && newFilters.page > 1) params.set("page", String(newFilters.page));
    
    router.push(`${ROUTES.admin.bookings.list}?${params.toString()}`);
  };

  if (!canViewBookings) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">
            Bookings
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Filter reservations, update lifecycle status, and review booking
            payment records.
          </p>
        </div>
        {canManageBookings && (
          <Button
            type="button"
            onClick={() => setIsQuickBookingOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Quick Booking
          </Button>
        )}
      </div>
      <BookingFilters filters={filters} onChange={handleFilterChange} />
      <BookingTable 
        bookings={data?.items ?? []} 
        isLoading={isLoading} 
        pagination={data?.pagination || undefined}
        onPageChange={(page) => handleFilterChange({ ...filters, page })}
      />
      <QuickBookingModal
        isOpen={isQuickBookingOpen}
        onClose={() => setIsQuickBookingOpen(false)}
      />
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-500">Loading booking list...</div>}>
      <BookingsListContent />
    </Suspense>
  );
}
