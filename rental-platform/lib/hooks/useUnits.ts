import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { unitsService } from "../api/services/units.service";
import { queryKeys } from "./query-keys";
import {
  UnitListFilters,
  CreateUnitRequest,
  UpdateUnitRequest,
  AddUnitImageRequest,
  ReorderUnitImagesRequest,
  CreateDateBlockRequest,
  UpdateDateBlockRequest,
  CreateSeasonalPricingRequest,
  UpdateSeasonalPricingRequest,
  CheckOperationalAvailabilityRequest,
} from "@/lib/types";

// ========================================
// PUBLIC QUERIES
// ========================================

export function usePublicUnitsList(filters?: object) {
  return useQuery({
    queryKey: queryKeys.units.publicList(filters),
    queryFn: () => unitsService.getPublicList(filters),
  });
}

export function usePublicUnitDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.units.publicDetail(id),
    queryFn: () => unitsService.getPublicById(id),
    enabled: !!id,
  });
}

export function usePublicUnitImages(unitId: string) {
  return useQuery({
    queryKey: queryKeys.units.images(unitId),
    queryFn: () => unitsService.getPublicImages(unitId),
    enabled: !!unitId,
  });
}

export function useUnitPricing(
  unitId: string,
  filterData: CheckOperationalAvailabilityRequest
) {
  return useQuery({
    queryKey: queryKeys.units.pricing(unitId, filterData),
    queryFn: () => unitsService.getUnitPricing(unitId, filterData),
    enabled: !!unitId && !!filterData.startDate && !!filterData.endDate,
  });
}

// ========================================
// INTERNAL QUERIES
// ========================================

export function useInternalUnitsList(
  filters?: UnitListFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.units.internalList(filters),
    queryFn: () => unitsService.getInternalList(filters),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
    enabled: options?.enabled ?? true,
  });
}

export function useInternalUnitDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.units.internalDetail(id),
    queryFn: () => unitsService.getInternalById(id),
    enabled: !!id,
  });
}

export function useUnitAmenities(unitId: string) {
  return useQuery({
    queryKey: queryKeys.units.amenities(unitId),
    queryFn: () => unitsService.getAmenities(unitId),
    enabled: !!unitId,
  });
}

export function useUnitDateBlocks(unitId: string) {
  return useQuery({
    queryKey: queryKeys.units.dateBlocks(unitId),
    queryFn: () => unitsService.getDateBlocks(unitId),
    enabled: !!unitId,
  });
}

export function useUnitSeasonalPricing(unitId: string) {
  return useQuery({
    queryKey: queryKeys.units.seasonalPricing(unitId),
    queryFn: () => unitsService.getSeasonalPricing(unitId),
    enabled: !!unitId,
  });
}

export function useAvailabilityCheck(
  unitId: string,
  month: number,
  year: number,
  filters: CheckOperationalAvailabilityRequest
) {
  return useQuery({
    queryKey: queryKeys.units.availability(unitId, month, year),
    queryFn: () => unitsService.checkOperationalAvailability(unitId, filters),
    enabled: !!unitId && !!filters.startDate && !!filters.endDate,
    staleTime: 0,
  });
}

// ========================================
// MUTATIONS
// ========================================

export function useCreateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUnitRequest) => unitsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all });
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUnitRequest }) =>
      unitsService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.publicDetail(variables.id),
      });
    },
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unitsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all });
    },
  });
}

export function useUpdateUnitStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      unitsService.updateStatus(id, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.publicDetail(variables.id),
      });
    },
  });
}

// ========================================
// IMAGE MUTATIONS
// ========================================

export function useAddUnitImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      unitId,
      data,
    }: {
      unitId: string;
      data: AddUnitImageRequest;
    }) => unitsService.addImage(unitId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.images(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.unitId),
      });
    },
  });
}

export function useReorderUnitImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      unitId,
      data,
    }: {
      unitId: string;
      data: ReorderUnitImagesRequest;
    }) => unitsService.reorderImages(unitId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.images(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.unitId),
      });
    },
  });
}

export function useSetUnitCoverImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, imageId }: { unitId: string; imageId: string }) =>
      unitsService.setCoverImage(unitId, imageId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.images(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.unitId),
      });
    },
  });
}

export function useDeleteUnitImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, imageId }: { unitId: string; imageId: string }) =>
      unitsService.deleteImage(unitId, imageId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.images(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.unitId),
      });
    },
  });
}

// ========================================
// AMENITY MUTATIONS
// ========================================

export function useReplaceUnitAmenities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      unitId,
      amenityIds,
    }: {
      unitId: string;
      amenityIds: string[];
    }) => unitsService.replaceAmenities(unitId, amenityIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.amenities(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.unitId),
      });
    },
  });
}

// ========================================
// DATE BLOCK MUTATIONS
// ========================================

export function useCreateDateBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      unitId,
      data,
    }: {
      unitId: string;
      data: CreateDateBlockRequest;
    }) => unitsService.createDateBlock(unitId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.dateBlocks(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.unitId),
      });
    },
  });
}

export function useUpdateDateBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      unitId: string;
      data: UpdateDateBlockRequest;
    }) => unitsService.updateDateBlock(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.dateBlocks(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.unitId),
      });
    },
  });
}

export function useDeleteDateBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; unitId: string }) =>
      unitsService.deleteDateBlock(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.dateBlocks(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.internalDetail(variables.unitId),
      });
    },
  });
}

// ========================================
// SEASONAL PRICING MUTATIONS
// ========================================

export function useCreateSeasonalPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      unitId,
      data,
    }: {
      unitId: string;
      data: CreateSeasonalPricingRequest;
    }) => unitsService.createSeasonalPricing(unitId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.seasonalPricing(variables.unitId),
      });
    },
  });
}

export function useUpdateSeasonalPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      unitId: string;
      data: UpdateSeasonalPricingRequest;
    }) => unitsService.updateSeasonalPricing(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.seasonalPricing(variables.unitId),
      });
    },
  });
}

export function useDeleteSeasonalPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; unitId: string }) =>
      unitsService.deleteSeasonalPricing(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.units.seasonalPricing(variables.unitId),
      });
    },
  });
}
