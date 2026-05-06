import type { PaginationMeta } from "@/lib/api/types";

// ── Status Types ──
export type CrmLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "lost";

// ── CRM Lead List Item (from GET /api/internal/crm/leads) ──
export interface CrmLeadListItemResponse {
  id: string;
  clientId: string | null;
  targetUnitId: string | null;
  assignedAdminUserId: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  leadStatus: CrmLeadStatus;
  source: string; // BookingSource PascalCase: 'Website'|'App'|'WhatsApp'|'PhoneCall'|'Referral'
  desiredCheckInDate: string | null;
  desiredCheckOutDate: string | null;
  guestCount: number | null;
  targetUnitName?: string | null;
  createdAt: string;
}

// ── CRM Lead Full Details (from GET /api/internal/crm/leads/{id}) ──
export interface CrmLeadDetailsResponse {
  id: string;
  clientId: string | null;
  targetUnitId: string | null;
  assignedAdminUserId: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  leadStatus: CrmLeadStatus;
  source: string;
  notes: string | null;
  desiredCheckInDate: string | null;
  desiredCheckOutDate: string | null;
  guestCount: number | null;
  targetUnitName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── CRM Lead Filters ──
export interface CrmLeadFilters {
  leadStatus?: CrmLeadStatus;
  assignedAdminUserId?: string;
  page?: number;
  pageSize?: number;
}

// ── Create Lead (admin-initiated) ──
export interface CreateCrmLeadRequest {
  clientId?: string;
  targetUnitId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  desiredCheckInDate?: string;
  desiredCheckOutDate?: string;
  guestCount?: number;
  source: string; // 'Website'|'App'|'WhatsApp'|'PhoneCall'|'Referral'
  notes?: string;
}

// ── Update Lead ──
export interface UpdateCrmLeadRequest {
  clientId?: string;
  targetUnitId?: string;
  assignedAdminUserId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  desiredCheckInDate?: string;
  desiredCheckOutDate?: string;
  guestCount?: number;
  source?: string;
  notes?: string;
}

// ── Status Transition ──
export interface UpdateCrmLeadStatusRequest {
  leadStatus: CrmLeadStatus;
}

// ── Convert to Booking ──
export interface ConvertLeadToBookingRequest {
  clientId: string;
  unitId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  internalNotes?: string;
}

// ── CRM Note ──
export interface CrmNoteResponse {
  id: string;
  bookingId: string | null;
  crmLeadId: string;
  createdByAdminUserId: string;
  noteText: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddLeadNoteRequest {
  noteText: string;
}

export interface UpdateCrmNoteRequest {
  noteText: string;
}

// ── CRM Assignment ──
export interface CrmAssignmentResponse {
  id: string;
  bookingId: string | null;
  crmLeadId: string;
  assignedAdminUserId: string;
  isActive: boolean;
  assignedAt: string;
  updatedAt: string;
}

export interface AssignLeadRequest {
  assignedAdminUserId: string;
}

// ── Paginated Leads ──
export interface PaginatedLeads {
  items: CrmLeadListItemResponse[];
  pagination: PaginationMeta;
}
