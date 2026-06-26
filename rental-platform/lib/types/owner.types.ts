import { PaginationMeta } from "@/lib/api/types";

// ── Owner status (lowercase per API design) ──
export type OwnerStatus = "active" | "inactive";

// ── Owner form values (for React Hook Form) ──
export interface OwnerFormValues {
  id?: string;
  name: string;
  phone: string;
  emergencyPhone: string;
  email?: string;
  detailedAddress?: string;
  password?: string;
  commissionRate: number;
  status: OwnerStatus;
  notes?: string;
}

// ── Owner list item ──
export interface OwnerListItemResponse {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  commissionRate: number; // percentage: 20.00 = 20%
  status: OwnerStatus;
  createdAt: string;
}

// ── Owner full detail ──
export interface OwnerDetailsResponse {
  id: string;
  name: string;
  phone: string;
  emergencyPhone: string;
  email: string | null;
  detailedAddress: string | null;
  commissionRate: number;
  status: OwnerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Owner Filters ──
export interface OwnerListFilters {
  includeInactive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ── Create/Update ──
export interface CreateOwnerRequest {
  name: string;
  phone: string;
  emergencyPhone: string;
  email?: string;
  detailedAddress?: string;
  password: string;
  commissionRate: number; // percentage: send 20.00 for 20%
  status: OwnerStatus;
  notes?: string;
}

export interface UpdateOwnerRequest {
  name: string;
  phone: string;
  emergencyPhone: string;
  email?: string;
  detailedAddress?: string;
  commissionRate: number;
  status: OwnerStatus;
  notes?: string;
}

export interface UpdateOwnerStatusRequest {
  status: OwnerStatus; // 'active' | 'inactive' (lowercase)
}

// ── Paginated Owners ──
export interface PaginatedOwners {
  items: OwnerListItemResponse[];
  pagination: PaginationMeta;
}

// ── Owner Units (Admin view) ──
export interface OwnerUnitResponse {
  id: string;
  name: string;
  unitType: string; // 'apartment' | 'villa' | 'chalet' | 'studio'
  projectId: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePricePerNight: number;
  isActive: boolean;
  createdAt: string;
}
