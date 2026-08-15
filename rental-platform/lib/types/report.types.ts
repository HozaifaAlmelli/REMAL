import type {
  BookingAnalyticsSummaryResponse,
  BookingAnalyticsDailySummaryResponse,
  FinanceAnalyticsSummaryResponse,
  FinanceAnalyticsDailySummaryResponse,
} from "./finance.types";
import type { PaginationMeta } from "@/lib/api/types";

export interface ReportDateFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportDailyFilters {
  dateFrom?: string;
  dateTo?: string;
}

export type HistoricalScope = "all" | "ordinary" | "historical";

export interface HistoricalDailyFilters {
  dateFrom: string;
  dateTo: string;
  includeHistorical?: boolean;
  historicalOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface HistoricalReconciliationFilters {
  stayMonthFrom: string;
  stayMonthTo: string;
  page?: number;
  pageSize?: number;
}

export interface OccupancyAnalyticsFilters {
  from: string;
  toExclusive: string;
}

export type OccupancyUnavailableReason =
  | "coverage_incomplete"
  | "zero_capacity"
  | "integrity_conflict";

export interface OccupancyAnalyticsResponse {
  from: string;
  toExclusive: string;
  occupiedUnitNights: number;
  availableUnitNights: number | null;
  occupancyRate: number | null;
  availabilityCoverageComplete: boolean;
  coverageStartDate: string | null;
  unavailableReason: OccupancyUnavailableReason | null;
}

export interface BookingAnalyticsStayDailySummaryResponse {
  stayStartDate: string;
  bookingSource: string;
  stayBookingsCount: number;
  prospectingBookingsCount: number;
  confirmedBookingsCount: number;
  cancelledBookingsCount: number;
  completedBookingsCount: number;
  totalFinalAmount: number;
  historicalBookingsCount: number;
  historicalAgreedAmount: number;
  historicalLegacySystemBookingsCount: number;
  historicalExternalPlatformBookingsCount: number;
  historicalOfflineRecordBookingsCount: number;
  historicalOtherSourceBookingsCount: number;
}

export interface FinanceAnalyticsStayDailySummaryResponse {
  stayStartDate: string;
  stayBookingsCount: number;
  bookingsWithInvoiceCount: number;
  totalInvoicedAmount: number;
  totalFinalAmount: number;
  historicalBookingsCount: number;
  historicalAgreedAmount: number;
  historicalBookingsWithInvoiceCount: number;
  historicalInvoicedAmount: number;
}

export interface HistoricalEntryReconciliationResponse {
  bookingId: string;
  recordedDate: string;
  recordedAt: string;
  actualBookedAt: string;
  entryLagDays: number;
  stayStartDate: string;
  stayEndDate: string;
  stayNights: number;
  bookingSource: string;
  originalSource: string;
  historicalEntryReason: string;
  bookingStatus: string;
  unitId: string;
  ownerId: string;
  agreedAmount: number;
  invoicedAmount: number;
  invoiceLinkedPaidAmount: number;
  ordinaryUnlinkedPaidCount: number;
  ordinaryUnlinkedPaidAmount: number;
  historicalPaymentEvidenceCount: number;
  historicalPaymentEvidenceAmount: number;
  firstEvidencePaidDate: string | null;
  lastEvidencePaidDate: string | null;
  ownerAttributionCorrectionCount: number;
  lastOwnerAttributionCorrectedAt: string | null;
}

export interface PaginatedReport<T> {
  items: T[];
  pagination: PaginationMeta;
}

export type {
  BookingAnalyticsSummaryResponse,
  BookingAnalyticsDailySummaryResponse,
  FinanceAnalyticsSummaryResponse,
  FinanceAnalyticsDailySummaryResponse,
};
