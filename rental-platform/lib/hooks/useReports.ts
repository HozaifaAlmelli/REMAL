import { useQuery } from "@tanstack/react-query";
import { reportsService } from "../api/services/reports.service";
import { unitsService } from "../api/services/units.service";
import { queryKeys } from "./query-keys";
import {
  HistoricalDailyFilters,
  HistoricalReconciliationFilters,
  ReportDateFilters,
  ReportDailyFilters,
} from "../types/report.types";

// Callers gate each query with the permission that guards its endpoint.
interface ReportQueryOptions {
  enabled?: boolean;
}

export const useReports = () => {
  return {
    useBookingsSummary: (
      filters?: ReportDateFilters,
      options?: ReportQueryOptions
    ) =>
      useQuery({
        queryKey: queryKeys.reports.bookingsSummary(filters || {}),
        queryFn: () => reportsService.getBookingsSummary(filters),
        enabled: options?.enabled !== false,
      }),

    useFinanceSummary: (
      filters?: ReportDateFilters,
      options?: ReportQueryOptions
    ) =>
      useQuery({
        queryKey: queryKeys.reports.financeSummary(filters || {}),
        queryFn: () => reportsService.getFinanceSummary(filters),
        enabled: options?.enabled !== false,
      }),

    useFinanceOverview: (
      filters?: ReportDateFilters,
      options?: ReportQueryOptions
    ) =>
      useQuery({
        queryKey: [...queryKeys.reports.financeSummary(filters || {}), "overview"],
        queryFn: () => reportsService.getFinanceOverview(filters),
        enabled: options?.enabled !== false,
      }),

    useBookingsDaily: (
      filters?: ReportDailyFilters,
      options?: ReportQueryOptions
    ) =>
      useQuery({
        queryKey: queryKeys.reports.bookingsDaily(filters || {}),
        queryFn: () => reportsService.getBookingsDaily(filters),
        enabled: options?.enabled !== false,
        staleTime: 1000 * 60 * 10, // 10 minutes
        select: (data: unknown) => {
          const d = data as Record<string, unknown>;
          return (Array.isArray(d?.items) ? d.items : Array.isArray(data) ? data : []) as import("../types/report.types").BookingAnalyticsDailySummaryResponse[];
        },
      }),

    useFinanceDaily: (
      filters?: ReportDailyFilters,
      options?: ReportQueryOptions
    ) =>
      useQuery({
        queryKey: queryKeys.reports.financeDaily(filters || {}),
        queryFn: () => reportsService.getFinanceDaily(filters),
        enabled: options?.enabled !== false,
        staleTime: 1000 * 60 * 10, // 10 minutes
        select: (data: unknown) => {
          const d = data as Record<string, unknown>;
          return (Array.isArray(d?.items) ? d.items : Array.isArray(data) ? data : []) as import("../types/report.types").FinanceAnalyticsDailySummaryResponse[];
        },
      }),

    useBookingsStayDaily: (
      filters: HistoricalDailyFilters,
      options?: ReportQueryOptions
    ) =>
      useQuery({
        queryKey: queryKeys.reports.bookingsStayDaily(filters),
        queryFn: () => reportsService.getBookingsStayDaily(filters),
        enabled: options?.enabled !== false,
        staleTime: 1000 * 60 * 10,
      }),

    useFinanceStayDaily: (
      filters: HistoricalDailyFilters,
      options?: ReportQueryOptions
    ) =>
      useQuery({
        queryKey: queryKeys.reports.financeStayDaily(filters),
        queryFn: () => reportsService.getFinanceStayDaily(filters),
        enabled: options?.enabled !== false,
        staleTime: 1000 * 60 * 10,
      }),

    useHistoricalReconciliation: (
      filters: HistoricalReconciliationFilters,
      options?: ReportQueryOptions
    ) =>
      useQuery({
        queryKey: queryKeys.reports.historicalReconciliation(filters),
        queryFn: () => reportsService.getHistoricalReconciliation(filters),
        enabled: options?.enabled !== false,
        staleTime: 1000 * 60 * 10,
      }),

    useActiveUnitsCount: (options?: ReportQueryOptions) =>
      useQuery({
        // Backend gap: isActive filter is not currently supported by GET /api/internal/units
        queryKey: queryKeys.units.internalList({
          page: 1,
          pageSize: 1,
        }),
        queryFn: () =>
          unitsService.getInternalList({
            page: 1,
            pageSize: 1,
          }),
        enabled: options?.enabled !== false,
        select: (data: unknown) => {
          const d = data as Record<string, unknown>;
          return (
            (d?.pagination as { totalCount?: number })?.totalCount ??
            (d?.length as number) ??
            0
          );
        },
      }),
  };
};
