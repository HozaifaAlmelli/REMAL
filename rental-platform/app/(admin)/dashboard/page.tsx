"use client";

import dynamic from "next/dynamic";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { StatCard } from "@/components/admin/dashboard/StatCard";
import { OccupancyWidget } from "@/components/admin/dashboard/OccupancyWidget";
import { TopUnitsWidget } from "@/components/admin/dashboard/TopUnitsWidget";
import { useReports } from "@/lib/hooks/useReports";
import { Building2, Users, CalendarCheck, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOpenLeadsCount } from "@/lib/hooks/useCrm";

const RevenueLineChart = dynamic(
  () =>
    import("@/components/admin/dashboard/RevenueLineChart").then((m) => ({
      default: m.RevenueLineChart,
    })),
  {
    ssr: false,
    loading: () => <Skeleton height={300} className="rounded-[4px]" />,
  }
);

const BookingsBarChart = dynamic(
  () =>
    import("@/components/admin/dashboard/BookingsBarChart").then((m) => ({
      default: m.BookingsBarChart,
    })),
  {
    ssr: false,
    loading: () => <Skeleton height={300} className="rounded-[4px]" />,
  }
);

export default function AdminDashboardPage() {
  const { canViewFinance, canViewUnits, canViewBookings, canViewCRM, canViewReports } =
    usePermissions();
  const {
    useBookingsSummary,
    useFinanceOverview,
    useActiveUnitsCount,
    useFinanceDaily,
    useBookingsDaily,
  } = useReports();

  // Date range for charts: last 30 days
  const dateTo = format(new Date(), "yyyy-MM-dd");
  const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");

  // Each query is gated by the exact permission guarding its endpoint.
  const { data: unitsCount, isLoading: unitsLoading } = useActiveUnitsCount({
    enabled: canViewUnits,
  });
  const { data: bookingsSummary, isLoading: bookingsLoading } =
    useBookingsSummary(undefined, { enabled: canViewBookings && canViewReports });
  const { data: openLeadsCount = 0, isLoading: leadsLoading } =
    useOpenLeadsCount(canViewCRM);
  const { data: financeSummary, isLoading: financeLoading } = useFinanceOverview(
    undefined,
    { enabled: canViewFinance }
  );

  // Chart data queries
  const { data: financeDaily, isLoading: financeLoading2 } = useFinanceDaily(
    { dateFrom, dateTo },
    { enabled: canViewFinance && canViewReports }
  );
  const { data: bookingsDaily, isLoading: bookingsLoading2 } = useBookingsDaily(
    { dateFrom, dateTo },
    { enabled: canViewBookings && canViewReports }
  );

  const activeBookingsCount = bookingsSummary?.totalConfirmedBookingsCount || 0;
  const totalRevenue = financeSummary?.totalPaidAmount || 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-1 pb-1">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Operations dashboard
        </h1>
        <p className="max-w-[72ch] text-sm text-neutral-600">
          {format(new Date(), "EEEE, d MMMM yyyy")} · Inventory, bookings,
          revenue, and occupancy at a glance.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {canViewUnits && (
          <StatCard
            title="Active units"
            value={unitsCount ?? 0}
            icon={Building2}
            isLoading={unitsLoading}
          />
        )}

        {canViewBookings && canViewReports && (
          <>
            {canViewCRM && (
              <StatCard
                title="Open leads"
                value={openLeadsCount}
                icon={Users}
                isLoading={leadsLoading}
              />
            )}
            <StatCard
              title="Active bookings"
              value={activeBookingsCount}
              icon={CalendarCheck}
              isLoading={bookingsLoading}
            />
          </>
        )}

        {canViewFinance && canViewReports && (
          <StatCard
            title="Platform paid revenue"
            value={formatCurrency(totalRevenue)}
            icon={DollarSign}
            isLoading={financeLoading}
          />
        )}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {canViewFinance && (
          <RevenueLineChart
            data={financeDaily ?? []}
            isLoading={financeLoading2}
          />
        )}
        {canViewBookings && canViewReports && (
          <BookingsBarChart
            data={bookingsDaily ?? []}
            isLoading={bookingsLoading2}
          />
        )}
      </div>

      {/* Occupancy + Top Units Widgets */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(360px,1.28fr)]">
        {canViewUnits && canViewReports && <OccupancyWidget />}
        {canViewUnits && <TopUnitsWidget />}
      </div>
    </div>
  );
}
