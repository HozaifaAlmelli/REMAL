// ───────────────────────────────────────────────────────────
// API contract — mirrors the .NET backend DTOs.
// Envelope: { success, data, message, errors, pagination }
// ───────────────────────────────────────────────────────────

export interface PaginationMeta {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errors: string[] | null;
  pagination: PaginationMeta | null;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta | null;
}

// ── Units ──
export interface UnitImage {
  id: string;
  unitId: string;
  fileKey: string;
  isCover: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface UnitListItem {
  id: string;
  ownerId: string;
  ownerName: string;
  projectId: string;
  projectName: string;
  name: string;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePricePerNight: number;
  isActive: boolean;
  createdAt: string;
  images: UnitImage[];
}

/** GET /api/units/{id} — note: does NOT include images (fetch those separately). */
export interface UnitDetails {
  id: string;
  ownerId: string;
  ownerName: string;
  projectId: string;
  projectName: string;
  name: string;
  description: string | null;
  address: string | null;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePricePerNight: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Projects ──
export interface Project {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Availability ──
export interface OperationalAvailability {
  unitId: string;
  startDate: string;
  endDate: string;
  isAvailable: boolean;
  reason: string | null;
  blockedDates: string[];
  heldDates: string[];
}

// ── Auth ──
export type SubjectType = "Admin" | "Owner" | "Client";

export interface AuthUser {
  userId: string;
  identifier: string;
  subjectType: SubjectType;
  adminRole: string | null;
  name: string | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  subjectType: SubjectType;
  adminRole: string | null;
  roleName: string | null;
  user: AuthUser;
  permissions: string[];
}

// ── Write payloads ──
export interface CreateLeadPayload {
  clientId?: string | null;
  targetUnitId?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  desiredCheckInDate?: string | null;
  desiredCheckOutDate?: string | null;
  guestCount?: number | null;
  source: string;
  notes?: string | null;
}

export interface CreateBookingPayload {
  unitId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
}

export interface CreateGuestBookingPayload extends CreateBookingPayload {
  firstName: string;
  lastName: string;
  phone: string;
}

export interface BookingDetails {
  id: string;
  clientId: string;
  unitId: string;
  unitName: string | null;
  ownerId: string;
  assignedAdminUserId: string | null;
  assignedAdminUserName: string | null;
  assignedAdminUserRole: string | null;
  bookingStatus: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  baseAmount: number;
  finalAmount: number;
  source: string;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  isAgedSoftHold: boolean;
  softHoldAgeDays: number | null;
}

export interface GuestBookingResponse {
  booking: BookingDetails;
  auth: AuthResponse;
}

export interface UnitCatalogParams {
  page?: number;
  pageSize?: number;
  projectId?: string;
  unitType?: string;
  minGuests?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: string;
}
