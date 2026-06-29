import { http } from "./client";
import type {
  CreateBookingPayload,
  CreateGuestBookingPayload,
  CreateLeadPayload,
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
    http.getPaginated<UnitListItem>("/api/units", { ...params }),

  getById: (id: string): Promise<UnitDetails> =>
    http.get<UnitDetails>(`/api/units/${id}`),

  getImages: (id: string): Promise<UnitImage[]> =>
    http.get<UnitImage[]>(`/api/units/${id}/images`),
};

export const projectsService = {
  list: (): Promise<Project[]> =>
    http.get<Project[]>("/api/projects", { includeInactive: false }),
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
  create: (payload: CreateLeadPayload): Promise<unknown> =>
    http.post<unknown>("/api/crm/leads", payload, { auth: false }),
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
