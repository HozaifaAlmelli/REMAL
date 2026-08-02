export type HistoricalEntryReason =
  | "offline_booking_recorded_after_stay"
  | "external_platform_import"
  | "late_operational_entry"
  | "accounting_reconciliation"
  | "other";

export type HistoricalOriginalSource =
  | "legacy_system"
  | "external_platform"
  | "offline_record"
  | "other";

export type HistoricalPaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "wallet";

export interface NewHistoricalClientRequest {
  name: string;
  phone: string;
  email?: string;
}

export interface RecordHistoricalBookingRequest {
  unitId: string;
  clientId?: string;
  newClient?: NewHistoricalClientRequest;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  actualBookedAt: string;
  historicalEntryReason: HistoricalEntryReason;
  historicalEntryNote?: string;
  originalSource: HistoricalOriginalSource;
  externalReference?: string;
  agreedAmount: number;
  internalNotes?: string;
  acknowledgedDuplicateOf: string[];
  acknowledgedDateBlockIds: string[];
}

export interface HistoricalBookingResponse {
  id: string;
  clientId: string;
  unitId: string;
  unitName: string | null;
  ownerId: string;
  assignedAdminUserId: string | null;
  assignedAdminUserName: string | null;
  assignedAdminUserRole: string | null;
  bookingStatus: "Completed";
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  baseAmount: number;
  finalAmount: number;
  source: string;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  isHistorical: true;
  actualBookedAt: string;
  historicalEntryReason: HistoricalEntryReason;
  historicalEntryNote: string | null;
  originalSource: HistoricalOriginalSource;
  originalSourceLabel: string;
  externalReference: string | null;
  agreedAmount: number;
  recordedAt: string;
  recordedByAdminUserId: string;
  idempotencyKey: string;
  statusHistoryEventId: string;
}

export interface HistoricalOwnerAttributionReviewResponse {
  bookingId: string;
  currentOwnerId: string;
  canCorrect: boolean;
  payoutReviewRequired: boolean;
  warnings: string[];
}

export interface RecordHistoricalPaymentRequest {
  amount: number;
  paymentMethod: HistoricalPaymentMethod;
  paidAt: string;
  referenceNumber?: string;
  reason: string;
}

export interface HistoricalPaymentResponse {
  paymentId: string;
  bookingId: string;
  amount: number;
  paymentMethod: HistoricalPaymentMethod;
  paidAt: string;
  referenceNumber: string | null;
  reason: string;
  isHistoricalRecord: true;
  recordedByAdminUserId: string;
  recordedAt: string;
  historyEventId: string;
}

export interface HistoricalConflictBookingMetadata {
  bookingId: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface HistoricalDateBlockMetadata {
  dateBlockId: string;
  startDate: string;
  endDate: string;
}
