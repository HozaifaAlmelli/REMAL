export type UnitType = "villa" | "chalet" | "studio";

export interface UnitListItemResponse {
  id: string;
  ownerId: string;
  ownerName: string;
  areaId: string;
  areaName: string;
  name: string;
  unitType: UnitType;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePricePerNight: number;
  isActive: boolean;
  createdAt: string;
}

export interface UnitDetailsResponse {
  id: string;
  ownerId: string;
  ownerName: string;
  areaId: string;
  areaName: string;
  name: string;
  description?: string | null;
  address?: string | null;
  unitType: UnitType;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePricePerNight: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  images?: UnitImageResponse[];
  amenities?: UnitAmenityResponse[];
}

export interface UnitListFilters {
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
  ownerId?: string;
  areaId?: string;
  unitType?: UnitType;
  isActive?: boolean;
  search?: string;
  availableFrom?: string; // YYYY-MM-DD
  availableTo?: string; // YYYY-MM-DD
}

export interface CreateUnitRequest {
  ownerId: string;
  areaId: string;
  name: string;
  description?: string;
  address?: string;
  unitType: UnitType;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePricePerNight: number;
  isActive?: boolean;
}

export interface UpdateUnitRequest {
  ownerId?: string;
  areaId?: string;
  name?: string;
  description?: string;
  address?: string;
  unitType?: UnitType;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  basePricePerNight?: number;
  isActive?: boolean;
}

export interface UnitImageResponse {
  id: string;
  unitId: string;
  fileKey: string;
  isCover: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface AddUnitImageRequest {
  fileKey: string;
  isCover?: boolean;
  displayOrder?: number;
}

export interface ReorderUnitImagesRequest {
  items: Array<{
    imageId: string;
    displayOrder: number;
  }>;
}

export interface UnitAmenityResponse {
  amenityId: string;
  name: string;
  icon: string | null;
}

export interface ReplaceUnitAmenitiesRequest {
  amenityIds: string[];
}

export type DateBlockReason = "Maintenance" | "OwnerUse" | "Other";

export interface DateBlockResponse {
  id: string;
  unitId: string;
  startDate: string;
  endDate: string;
  reason: DateBlockReason;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDateBlockRequest {
  startDate: string;
  endDate: string;
  reason: DateBlockReason;
  notes?: string;
}

export interface UpdateDateBlockRequest {
  startDate?: string;
  endDate?: string;
  reason?: string;
  notes?: string;
}

export interface SeasonalPricingResponse {
  id: string;
  unitId: string;
  startDate: string;
  endDate: string;
  pricePerNight: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeasonalPricingRequest {
  startDate: string;
  endDate: string;
  pricePerNight: number;
}

export interface UpdateSeasonalPricingRequest {
  startDate?: string;
  endDate?: string;
  pricePerNight?: number;
}

export interface CheckOperationalAvailabilityRequest {
  startDate: string;
  endDate: string;
}

export interface OperationalAvailabilityResponse {
  unitId: string;
  startDate: string;
  endDate: string;
  isAvailable: boolean;
  reason: string;
  blockedDates: string[];
}

export interface UnitPricingResponse {
  unitId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  nights: NightlyPriceItem[];
}

export interface NightlyPriceItem {
  date: string;
  pricePerNight: number;
  priceSource: "SeasonalPricing" | "BasePrice";
}

export interface PaginatedUnits {
  items: UnitListItemResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
