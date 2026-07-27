import { http } from "./client";
import { ApiError } from "./api-error";
import type {
  CreateBookingPayload,
  CreateGuestBookingPayload,
  CreateRecommendationPayload,
  GuestBookingResponse,
  OperationalAvailability,
  Paginated,
  Project,
  UnitCatalogParams,
  UnitDetails,
  UnitImage,
  UnitListItem,
} from "./types";

export const unitsService = {
  list: (params: UnitCatalogParams = {}): Promise<Paginated<UnitListItem>> =>
    http.getPaginated<UnitListItem>(
      "/api/units",
      { ...params },
      { cache: "no-store" }
    ),

  getById: (id: string): Promise<UnitDetails> =>
    http.get<UnitDetails>(`/api/units/${id}`, undefined, {
      cache: "no-store",
    }),

  getImages: (id: string): Promise<UnitImage[]> =>
    http.get<UnitImage[]>(`/api/units/${id}/images`),
};

export const projectsService = {
  list: (): Promise<Project[]> =>
    http.get<Project[]>(
      "/api/projects",
      { includeInactive: false },
      { cache: "no-store" }
    ),
};

export const availabilityService = {
  check: (
    unitId: string,
    startDate: string,
    endDate: string
  ): Promise<OperationalAvailability> =>
    http.post<OperationalAvailability>(
      `/api/units/${unitId}/availability/operational-check`,
      { startDate, endDate },
      { auth: false }
    ),
};

export const leadsService = {
  create: async (payload: CreateRecommendationPayload): Promise<unknown> => {
    try {
      return await http.post<unknown>(
        "/api/crm/leads/recommendation-request",
        payload,
        { auth: false }
      );
    } catch (error) {
      // During a deploy or rollback, one side may briefly lack the new route.
      // Preserve the inquiry through the legacy path; it remains unclassified.
      if (error instanceof ApiError && error.status === 404) {
        return http.post<unknown>(
          "/api/crm/leads",
          { ...payload, source: "website" },
          { auth: false }
        );
      }
      throw error;
    }
  },
};

export const bookingsService = {
  // Requires a Client session (Authorization: Bearer ...).
  createOwn: (payload: CreateBookingPayload): Promise<unknown> =>
    http.post<unknown>("/api/client/bookings", payload),

  createGuest: (payload: CreateGuestBookingPayload): Promise<GuestBookingResponse> =>
    http.post<GuestBookingResponse>("/api/client/bookings/guest", payload, {
      auth: false,
    }),
};
