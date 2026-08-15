import api from "@/lib/api/axios";
import { endpoints } from "@/lib/api/endpoints";
import type {
  BookingAnalyticsSummaryResponse,
  BookingAnalyticsDailySummaryResponse,
  FinanceAnalyticsSummaryResponse,
  FinanceAnalyticsDailySummaryResponse,
  ReportDateFilters,
  ReportDailyFilters,
  HistoricalDailyFilters,
  HistoricalReconciliationFilters,
  OccupancyAnalyticsFilters,
  OccupancyAnalyticsResponse,
  BookingAnalyticsStayDailySummaryResponse,
  FinanceAnalyticsStayDailySummaryResponse,
  HistoricalEntryReconciliationResponse,
  PaginatedReport,
} from "@/lib/types/report.types";

export const reportsService = {
  getBookingsSummary: async (
    filters?: ReportDateFilters
  ): Promise<BookingAnalyticsSummaryResponse> => {
    return api.get(endpoints.reportsBookings.summary, { params: filters });
  },

  getBookingsDaily: async (
    filters?: ReportDailyFilters
  ): Promise<BookingAnalyticsDailySummaryResponse[]> => {
    return api.get(endpoints.reportsBookings.daily, { params: filters });
  },

  getFinanceSummary: async (
    filters?: ReportDateFilters
  ): Promise<FinanceAnalyticsSummaryResponse> => {
    return api.get(endpoints.reportsFinance.summary, { params: filters });
  },

  getFinanceOverview: async (
    filters?: ReportDateFilters
  ): Promise<FinanceAnalyticsSummaryResponse> => {
    return api.get(endpoints.financeSummary.overview, { params: filters });
  },

  getFinanceDaily: async (
    filters?: ReportDailyFilters
  ): Promise<FinanceAnalyticsDailySummaryResponse[]> => {
    return api.get(endpoints.reportsFinance.daily, { params: filters });
  },

  getBookingsStayDaily: async (
    filters: HistoricalDailyFilters
  ): Promise<PaginatedReport<BookingAnalyticsStayDailySummaryResponse>> =>
    api.get(endpoints.reportsBookings.stayDaily, { params: filters }),

  getFinanceStayDaily: async (
    filters: HistoricalDailyFilters
  ): Promise<PaginatedReport<FinanceAnalyticsStayDailySummaryResponse>> =>
    api.get(endpoints.reportsFinance.stayDaily, { params: filters }),

  getHistoricalReconciliation: async (
    filters: HistoricalReconciliationFilters
  ): Promise<PaginatedReport<HistoricalEntryReconciliationResponse>> =>
    api.get(endpoints.reportsBookings.historicalReconciliation, {
      params: filters,
    }),

  getOccupancy: async (
    filters: OccupancyAnalyticsFilters
  ): Promise<OccupancyAnalyticsResponse> =>
    api.get(endpoints.reportsOccupancy.summary, { params: filters }),
};
