import api from "../axios";
import { endpoints } from "../endpoints";
import {
  PaginatedUnits,
  UnitDetailsResponse,
  UnitImageResponse,
  UnitPricingResponse,
  UnitListFilters,
  CreateUnitRequest,
  UpdateUnitRequest,
  UpdateUnitPortfolioVisibilityRequest,
  AddUnitImageRequest,
  ReorderUnitImagesRequest,
  UnitAmenityResponse,
  DateBlockResponse,
  CreateDateBlockRequest,
  UpdateDateBlockRequest,
  SeasonalPricingResponse,
  CreateSeasonalPricingRequest,
  UpdateSeasonalPricingRequest,
  CheckOperationalAvailabilityRequest,
  OperationalAvailabilityResponse,
} from "@/lib/types";

export const unitsService = {
  // Public
  getPublicList: (filters?: object): Promise<PaginatedUnits> =>
    api.get(endpoints.units.publicList, { params: filters }),

  getPublicById: (id: string): Promise<UnitDetailsResponse> =>
    api.get(endpoints.units.publicById(id)),

  getPublicImages: (unitId: string): Promise<UnitImageResponse[]> =>
    api.get(endpoints.units.images(unitId)),

  getUnitPricing: (
    unitId: string,
    dataPayload: CheckOperationalAvailabilityRequest
  ): Promise<UnitPricingResponse> =>
    api.post(endpoints.units.pricingCalculate(unitId), dataPayload),

  // Internal
  getInternalList: (filters?: UnitListFilters): Promise<PaginatedUnits> =>
    api.get(endpoints.internalUnits.list, { params: filters }),

  getInternalById: (id: string): Promise<UnitDetailsResponse> =>
    api.get(endpoints.internalUnits.byId(id)),

  create: (dataPayload: CreateUnitRequest): Promise<UnitDetailsResponse> =>
    api.post(endpoints.internalUnits.create, dataPayload),

  update: (
    id: string,
    dataPayload: UpdateUnitRequest
  ): Promise<UnitDetailsResponse> =>
    api.put(endpoints.internalUnits.update(id), dataPayload),

  delete: (id: string): Promise<void> =>
    api.delete(endpoints.internalUnits.delete(id)),

  updateStatus: (
    id: string,
    isActive: boolean
  ): Promise<UnitDetailsResponse> =>
    api.patch(endpoints.internalUnits.status(id), { isActive }),

  updatePortfolioVisibility: (
    id: string,
    dataPayload: UpdateUnitPortfolioVisibilityRequest
  ): Promise<UnitDetailsResponse> =>
    api.patch(endpoints.internalUnits.portfolioVisibility(id), dataPayload),

  // Images
  addImage: (
    unitId: string,
    dataPayload: AddUnitImageRequest
  ): Promise<UnitImageResponse> =>
    api.post(endpoints.internalUnitImages.create(unitId), dataPayload),

  uploadImage: (
    unitId: string,
    formData: FormData
  ): Promise<UnitImageResponse> =>
    api.post(endpoints.internalUnitImages.upload(unitId), formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  reorderImages: (
    unitId: string,
    dataPayload: ReorderUnitImagesRequest
  ): Promise<void> =>
    api.put(endpoints.internalUnitImages.reorder(unitId), dataPayload),

  setCoverImage: (unitId: string, imageId: string): Promise<void> =>
    api.patch(endpoints.internalUnitImages.cover(unitId, imageId)),

  deleteImage: (unitId: string, imageId: string): Promise<void> =>
    api.delete(endpoints.internalUnitImages.delete(unitId, imageId)),

  // Amenities
  getAmenities: (unitId: string): Promise<UnitAmenityResponse[]> =>
    api.get(endpoints.units.amenities(unitId)),

  replaceAmenities: (
    unitId: string,
    amenityIds: string[]
  ): Promise<UnitAmenityResponse[]> =>
    api.put(endpoints.internalUnitAmenities.replace(unitId), { amenityIds }),

  // Date blocks
  getDateBlocks: (unitId: string): Promise<DateBlockResponse[]> =>
    api.get(endpoints.dateBlocks.list(unitId)),

  createDateBlock: (
    unitId: string,
    dataPayload: CreateDateBlockRequest
  ): Promise<DateBlockResponse> =>
    api.post(endpoints.dateBlocks.create(unitId), dataPayload),

  updateDateBlock: (
    id: string,
    dataPayload: UpdateDateBlockRequest
  ): Promise<DateBlockResponse> =>
    api.put(endpoints.dateBlocks.update(id), dataPayload),

  deleteDateBlock: (id: string): Promise<void> =>
    api.delete(endpoints.dateBlocks.delete(id)),

  // Seasonal pricing
  getSeasonalPricing: (unitId: string): Promise<SeasonalPricingResponse[]> =>
    api.get(endpoints.seasonalPricing.list(unitId)),

  createSeasonalPricing: (
    unitId: string,
    dataPayload: CreateSeasonalPricingRequest
  ): Promise<SeasonalPricingResponse> =>
    api.post(endpoints.seasonalPricing.create(unitId), dataPayload),

  updateSeasonalPricing: (
    id: string,
    dataPayload: UpdateSeasonalPricingRequest
  ): Promise<SeasonalPricingResponse> =>
    api.put(endpoints.seasonalPricing.update(id), dataPayload),

  deleteSeasonalPricing: (id: string): Promise<void> =>
    api.delete(endpoints.seasonalPricing.delete(id)),

  // Availability
  checkOperationalAvailability: (
    unitId: string,
    dataPayload: CheckOperationalAvailabilityRequest
  ): Promise<OperationalAvailabilityResponse> =>
    api.post(endpoints.units.operationalCheck(unitId), dataPayload),
};
