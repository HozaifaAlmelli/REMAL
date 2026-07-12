import type { UnitCatalogParams } from "@/lib/api/types";

export interface SearchFilters {
  projectId: string;
  minGuests: string;
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  projectId: "",
  minGuests: "",
};

function parsePositiveInteger(value: string | null): string {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : "";
}

export function parseSearchFilters(params: URLSearchParams): SearchFilters {
  return {
    projectId: params.get("projectId")?.trim() ?? "",
    minGuests: parsePositiveInteger(params.get("minGuests")),
  };
}

export function buildSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.minGuests) params.set("minGuests", filters.minGuests);

  return params;
}

export function toCatalogParams(filters: SearchFilters): UnitCatalogParams {
  return {
    page: 1,
    pageSize: 100,
    projectId: filters.projectId || undefined,
    minGuests: filters.minGuests ? Number(filters.minGuests) : undefined,
  };
}
