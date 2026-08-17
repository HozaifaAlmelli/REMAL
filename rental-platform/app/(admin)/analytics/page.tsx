"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useReports } from "@/lib/hooks/useReports";
import {
  ReportRangeFilter,
  DEFAULT_REPORT_RANGE,
  type ReportRangeValue,
} from "@/components/admin/analytics/ReportRangeFilter";
import { HistoricalScopeControl } from "@/components/admin/analytics/HistoricalScopeControl";
import { BookingsFunnelChart } from "@/components/admin/analytics/BookingsFunnelChart";
import { DailyRevenueTable } from "@/components/admin/analytics/DailyRevenueTable";
import { DailyBookingsTable } from "@/components/admin/analytics/DailyBookingsTable";
import { StayBookingsTable } from "@/components/admin/analytics/StayBookingsTable";
import { StayFinanceTable } from "@/components/admin/analytics/StayFinanceTable";
import { HistoricalReconciliationTable } from "@/components/admin/analytics/HistoricalReconciliationTable";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { historicalScopeToQuery } from "@/lib/historical-reporting/presentation";
import type { HistoricalScope } from "@/lib/types/report.types";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  Banknote,
  CalendarDays,
  DollarSign,
  FileClock,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

const RevenueLineChart = dynamic(
  () =>
    import("@/components/admin/dashboard/RevenueLineChart").then((module) => ({
      default: module.RevenueLineChart,
    })),
  {
    ssr: false,
    loading: () => <Skeleton height={300} className="rounded-lg" />,
  }
);

type AnalyticsView = "recorded" | "stay" | "reconciliation";

const ANALYTICS_VIEWS: ReadonlyArray<{
  value: AnalyticsView;
  label: string;
}> = [
  { value: "recorded", label: "Recorded" },
  { value: "stay", label: "Stay" },
  { value: "reconciliation", label: "Reconciliation" },
];

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  tone?: "neutral" | "historical";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-5",
        tone === "historical" ? "border-amber-200" : "border-neutral-200"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon
          className={cn(
            "h-5 w-5",
            tone === "historical" ? "text-amber-700" : "text-neutral-500"
          )}
          aria-hidden="true"
        />
        <span className="text-xl font-semibold tabular-nums text-neutral-900">
          {value}
        </span>
      </div>
      <p className="mt-3 text-sm text-neutral-600">{label}</p>
    </div>
  );
}

function ReportPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm text-neutral-600">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

export default function AnalyticsPage() {
  const { canViewReports } = usePermissions();
  const [range, setRange] = useState<ReportRangeValue>(DEFAULT_REPORT_RANGE);
  const [view, setView] = useState<AnalyticsView>("recorded");
  const [scope, setScope] = useState<HistoricalScope>("all");
  const [page, setPage] = useState(1);

  const dateFrom = range.from ? format(range.from, "yyyy-MM-dd") : undefined;
  const dateTo = range.to ? format(range.to, "yyyy-MM-dd") : undefined;
  const hasFiniteRange = Boolean(dateFrom && dateTo);
  const recordedFilters = { dateFrom, dateTo };
  const scopeQuery = historicalScopeToQuery(scope);
  const stayFilters = {
    dateFrom: dateFrom ?? "",
    dateTo: dateTo ?? "",
    ...scopeQuery,
    page,
    pageSize: 30,
  };
  const reconciliationFilters = {
    stayMonthFrom: range.from ? format(range.from, "yyyy-MM") : "",
    stayMonthTo: range.to ? format(range.to, "yyyy-MM") : "",
    page,
    pageSize: 30,
  };

  const {
    useFinanceSummary,
    useFinanceDaily,
    useBookingsSummary,
    useBookingsDaily,
    useBookingsStayDaily,
    useFinanceStayDaily,
    useHistoricalReconciliation,
  } = useReports();

  const financeSummary = useFinanceSummary(recordedFilters, {
    enabled: view === "recorded" && canViewReports,
  });
  const financeDaily = useFinanceDaily(recordedFilters, {
    enabled: view === "recorded" && canViewReports,
  });
  const bookingsSummary = useBookingsSummary(recordedFilters, {
    enabled: view === "recorded" && canViewReports,
  });
  const bookingsDaily = useBookingsDaily(recordedFilters, {
    enabled: view === "recorded" && canViewReports,
  });
  const bookingsStay = useBookingsStayDaily(stayFilters, {
    enabled: view === "stay" && canViewReports && hasFiniteRange,
  });
  const financeStay = useFinanceStayDaily(stayFilters, {
    enabled: view === "stay" && canViewReports && hasFiniteRange,
  });
  const reconciliation = useHistoricalReconciliation(reconciliationFilters, {
    enabled: view === "reconciliation" && canViewReports && hasFiniteRange,
  });

  if (!canViewReports) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-800">
            Analytics access required
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Historical write access does not grant report access. Ask a super admin if you need analytics:read.
          </p>
        </div>
      </div>
    );
  }

  const setAnalyticsView = (next: AnalyticsView) => {
    setView(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">
            Performance analytics
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">
            Recorded activity and stay-period truth are separate views. They answer different questions and are never added together.
          </p>
        </div>
        <ReportRangeFilter
          value={range}
          onChange={(next) => {
            setRange(next);
            setPage(1);
          }}
        />
      </div>

      <div className="flex flex-col gap-3 border-b border-neutral-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Reporting axis" className="flex gap-1">
          {ANALYTICS_VIEWS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={view === option.value}
              onClick={() => setAnalyticsView(option.value)}
              className={cn(
                "min-h-10 border-b-2 px-3 text-sm font-semibold",
                view === option.value
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {view === "stay" && (
          <HistoricalScopeControl
            value={scope}
            onChange={(next) => {
              setScope(next);
              setPage(1);
            }}
          />
        )}
      </div>

      {!hasFiniteRange && view !== "recorded" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Stay and reconciliation reports require a finite date range of up to 24 months. Choose a preset or custom range.
        </div>
      )}

      {view === "recorded" && (
        <>
          <section aria-labelledby="recorded-summary-title" className="space-y-3">
            <div>
              <h2 id="recorded-summary-title" className="text-lg font-semibold text-neutral-900">
                Recorded activity
              </h2>
              <p className="text-sm text-neutral-500">
                Bookings entered in KAZA by recorded date. Historical values are subset markers, not additions to the All totals.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {financeSummary.isLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-lg" />
                ))
              ) : financeSummary.data ? (
                <>
                  <MetricCard label="Invoiced amount" value={formatCurrency(financeSummary.data.totalInvoicedAmount)} icon={DollarSign} />
                  <MetricCard label="Platform paid" value={formatCurrency(financeSummary.data.totalPaidAmount)} icon={TrendingUp} />
                  <MetricCard label="Outstanding balance" value={formatCurrency(financeSummary.data.totalRemainingAmount)} icon={TrendingDown} />
                  <MetricCard label="Pending owner payouts" value={formatCurrency(financeSummary.data.totalPendingPayoutAmount)} icon={Wallet} />
                  <MetricCard label="Historical agreed value" value={formatCurrency(financeSummary.data.historicalAgreedAmount)} icon={FileClock} tone="historical" />
                  <MetricCard label="Historical Payment Evidence" value={formatCurrency(financeSummary.data.historicalPaymentEvidenceAmount)} icon={Banknote} tone="historical" />
                  <MetricCard label="Historical evidence records" value={String(financeSummary.data.historicalPaymentEvidenceCount)} icon={CalendarDays} tone="historical" />
                  <MetricCard label="Ordinary unlinked paid" value={formatCurrency(financeSummary.data.ordinaryUnlinkedPaidAmount)} icon={Banknote} />
                </>
              ) : null}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RevenueLineChart data={financeDaily.data ?? []} isLoading={financeDaily.isLoading} />
            <BookingsFunnelChart data={bookingsSummary.data} isLoading={bookingsSummary.isLoading} />
          </div>

          <section className="space-y-2" aria-labelledby="recorded-finance-title">
            <h2 id="recorded-finance-title" className="text-lg font-semibold text-neutral-800">
              Finance by recorded date
            </h2>
            <DailyRevenueTable data={financeDaily.data ?? []} isLoading={financeDaily.isLoading} />
          </section>

          <section className="space-y-2" aria-labelledby="recorded-bookings-title">
            <h2 id="recorded-bookings-title" className="text-lg font-semibold text-neutral-800">
              Bookings entered in KAZA by recorded date
            </h2>
            <DailyBookingsTable data={bookingsDaily.data ?? []} isLoading={bookingsDaily.isLoading} />
          </section>
        </>
      )}

      {view === "stay" && hasFiniteRange && (
        <>
          <section className="space-y-2" aria-labelledby="stay-bookings-title">
            <h2 id="stay-bookings-title" className="text-lg font-semibold text-neutral-800">
              Bookings by stay start date
            </h2>
            <p className="text-sm text-neutral-500">
              Each booking appears once at check-in. A Historical stay recorded today remains in its original stay period.
            </p>
            <StayBookingsTable data={bookingsStay.data?.items ?? []} isLoading={bookingsStay.isLoading} />
          </section>

          <section className="space-y-2" aria-labelledby="stay-finance-title">
            <h2 id="stay-finance-title" className="text-lg font-semibold text-neutral-800">
              Contracted and invoiced value by stay start
            </h2>
            <StayFinanceTable data={financeStay.data?.items ?? []} isLoading={financeStay.isLoading} />
          </section>

          <ReportPagination
            page={page}
            totalPages={Math.max(
              bookingsStay.data?.pagination.totalPages ?? 1,
              financeStay.data?.pagination.totalPages ?? 1
            )}
            onChange={setPage}
          />
        </>
      )}

      {view === "reconciliation" && hasFiniteRange && (
        <section className="space-y-3" aria-labelledby="reconciliation-title">
          <div>
            <h2 id="reconciliation-title" className="text-lg font-semibold text-neutral-800">
              Historical reconciliation by booking
            </h2>
            <p className="text-sm text-neutral-500">
              Pull-only operational evidence. No client PII, payment references, webhook, or scheduled push is exposed here.
            </p>
          </div>
          <HistoricalReconciliationTable
            data={reconciliation.data?.items ?? []}
            isLoading={reconciliation.isLoading}
          />
          <ReportPagination
            page={page}
            totalPages={reconciliation.data?.pagination.totalPages ?? 1}
            onChange={setPage}
          />
        </section>
      )}
    </div>
  );
}
