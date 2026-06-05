import { APIRequestContext, APIResponse, expect } from "@playwright/test";
import { ADMIN_USERS, CLIENT_PASSWORD, OWNER_USERS, TEST_PREFIX } from "../fixtures/test-data";
import { apiUrl } from "./smoke-env";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message?: string | null;
  errors?: string[] | null;
  pagination?: PaginationMeta | null;
}

export interface PaginationMeta {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface GeneratedClient {
  id: string;
  name: string;
  phone: string;
  email: string;
  password: string;
}

export interface PublicUnitListItem {
  id: string;
  ownerId: string;
  areaId: string;
  name: string;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePricePerNight: number;
  isActive: boolean;
  images?: UnitImageResponse[];
}

export interface PublicUnitDetail extends PublicUnitListItem {
  description: string | null;
  address: string | null;
}

export interface UnitImageResponse {
  id: string;
  unitId: string;
  fileKey: string;
  isCover: boolean;
  displayOrder: number;
}

export interface AreaResponse {
  id: string;
  name: string;
  isActive: boolean;
}

export interface InternalUnitResponse {
  id: string;
  name?: string;
  unitName?: string;
  isActive?: boolean;
  images?: UnitImageResponse[];
}

export interface ClientListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
}

export interface CrmLeadDetails {
  id: string;
  clientId: string | null;
  targetUnitId: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  desiredCheckInDate: string | null;
  desiredCheckOutDate: string | null;
  guestCount: number | null;
  leadStatus: string;
}

export interface BookingListItem {
  id: string;
  clientId: string;
  unitId: string;
  unitName: string | null;
  ownerId: string;
  bookingStatus: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  finalAmount: number;
  clientPhone?: string | null;
  clientName?: string | null;
}

export interface BookingDetails extends BookingListItem {
  baseAmount: number;
  source: string;
}

export interface ReviewResponse {
  id: string;
  bookingId: string;
  unitId: string;
  clientId: string;
  ownerId: string;
  rating: number;
  title: string;
  comment: string | null;
  reviewStatus: string;
}

export interface NotificationListItem {
  notificationId: string;
  channel: string;
  notificationStatus: string;
  subject: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationResponse {
  id: string;
  channel: string;
  notificationStatus: string;
  subject: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface PublicReviewSummary {
  unitId: string;
  publishedReviewCount: number;
  averageRating: number;
  lastReviewPublishedAt: string | null;
}

export interface AvailabilityResponse {
  unitId: string;
  startDate: string;
  endDate: string;
  isAvailable: boolean;
  reason: string | null;
  blockedDates: string[];
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function responseText(response: APIResponse): Promise<string> {
  try {
    return await response.text();
  } catch {
    return response.statusText();
  }
}

export async function unwrapResponse<T>(
  response: APIResponse,
  label: string
): Promise<T> {
  if (!response.ok()) {
    throw new Error(
      `${label} failed with ${response.status()}: ${await responseText(response)}`
    );
  }

  const body = (await response.json()) as ApiEnvelope<T>;
  if (body.success === false) {
    throw new Error(
      `${label} returned failure envelope: ${body.message ?? body.errors?.join(", ") ?? "Request failed"}`
    );
  }

  if (body.data === null || body.data === undefined) {
    throw new Error(`${label} returned an empty data envelope.`);
  }

  return body.data;
}

export async function unwrapPaginatedResponse<T>(
  response: APIResponse,
  label: string
): Promise<PaginatedResult<T>> {
  if (!response.ok()) {
    throw new Error(
      `${label} failed with ${response.status()}: ${await responseText(response)}`
    );
  }

  const body = (await response.json()) as ApiEnvelope<T[]>;
  if (body.success === false) {
    throw new Error(
      `${label} returned failure envelope: ${body.message ?? body.errors?.join(", ") ?? "Request failed"}`
    );
  }

  return {
    items: body.data ?? [],
    pagination:
      body.pagination ?? { totalCount: 0, page: 1, pageSize: 0, totalPages: 1 },
  };
}

export async function getAdminApiToken(
  request: APIRequestContext,
  role: keyof typeof ADMIN_USERS = "SuperAdmin"
): Promise<string> {
  const credentials = ADMIN_USERS[role];
  const response = await request.post(apiUrl("/api/auth/admin/login"), {
    data: { email: credentials.email, password: credentials.password },
  });
  const auth = await unwrapResponse<{ accessToken: string }>(
    response,
    `Login as admin ${role}`
  );
  return auth.accessToken;
}

export async function getOwnerApiToken(
  request: APIRequestContext,
  ownerKey: keyof typeof OWNER_USERS = "OwnerA"
): Promise<string> {
  const credentials = OWNER_USERS[ownerKey];
  const response = await request.post(apiUrl("/api/auth/owner/login"), {
    data: { phone: credentials.phone, password: credentials.password },
  });
  const auth = await unwrapResponse<{ accessToken: string }>(
    response,
    `Login as owner ${ownerKey}`
  );
  return auth.accessToken;
}

export async function getClientApiToken(
  request: APIRequestContext,
  phone: string,
  password: string
): Promise<string> {
  const response = await request.post(apiUrl("/api/auth/client/login"), {
    data: { phone, password },
  });
  const auth = await unwrapResponse<{ accessToken: string }>(
    response,
    "Login as client"
  );
  return auth.accessToken;
}

export function uniqueRunId(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export function uniqueEgyptianPhone(): string {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    .replace(/\D/g, "")
    .slice(-8)
    .padStart(8, "0");
  return `010${suffix}`;
}

export async function registerGeneratedClient(
  request: APIRequestContext,
  label = uniqueRunId()
): Promise<GeneratedClient> {
  const phone = uniqueEgyptianPhone();
  const client = {
    name: `${TEST_PREFIX}Client_${label}`,
    phone,
    email: `client-smoke-${label.replace(/_/g, "-")}@example.test`,
    password: CLIENT_PASSWORD,
  };

  const response = await request.post(apiUrl("/api/auth/client/register"), {
    data: client,
  });
  const profile = await unwrapResponse<{ id: string }>(
    response,
    "Register generated client"
  );
  return { ...client, id: profile.id };
}

export async function createTestArea(
  request: APIRequestContext,
  adminToken: string,
  name: string
): Promise<AreaResponse> {
  const response = await request.post(apiUrl("/api/areas"), {
    headers: authHeaders(adminToken),
    data: {
      name,
      description: "Client smoke generated area",
      isActive: true,
    },
  });
  return unwrapResponse<AreaResponse>(response, "Create client smoke area");
}

export async function deactivateArea(
  request: APIRequestContext,
  adminToken: string,
  areaId: string
): Promise<boolean> {
  const response = await request.patch(apiUrl(`/api/areas/${areaId}/status`), {
    headers: authHeaders(adminToken),
    data: { isActive: false },
  });
  return response.ok() || response.status() === 404;
}

export async function createTestUnit<T = PublicUnitDetail>(
  request: APIRequestContext,
  adminToken: string,
  unitData: unknown
): Promise<T> {
  const response = await request.post(apiUrl("/api/internal/units"), {
    headers: authHeaders(adminToken),
    data: unitData,
  });
  return unwrapResponse<T>(response, "Create client smoke unit");
}

export async function deleteUnit(
  request: APIRequestContext,
  adminToken: string,
  unitId: string
): Promise<boolean> {
  const response = await request.delete(apiUrl(`/api/internal/units/${unitId}`), {
    headers: authHeaders(adminToken),
  });
  return response.ok() || response.status() === 404;
}

export async function addUnitImage(
  request: APIRequestContext,
  adminToken: string,
  unitId: string,
  fileKey: string
): Promise<UnitImageResponse> {
  const response = await request.post(
    apiUrl(`/api/internal/units/${unitId}/images`),
    {
      headers: authHeaders(adminToken),
      data: { fileKey, isCover: true, displayOrder: 1 },
    }
  );
  return unwrapResponse<UnitImageResponse>(response, "Add client smoke image");
}

export async function deleteUnitImage(
  request: APIRequestContext,
  adminToken: string,
  unitId: string,
  imageId: string
): Promise<boolean> {
  const response = await request.delete(
    apiUrl(`/api/internal/units/${unitId}/images/${imageId}`),
    { headers: authHeaders(adminToken) }
  );
  return response.ok() || response.status() === 404;
}

export async function getPublicUnits(
  request: APIRequestContext,
  params?: Record<string, string | number | boolean | undefined>
): Promise<PaginatedResult<PublicUnitListItem>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const suffix = search.toString() ? `?${search}` : "";
  const response = await request.get(apiUrl(`/api/units${suffix}`));
  return unwrapPaginatedResponse<PublicUnitListItem>(response, "Get public units");
}

export async function getPublicUnit(
  request: APIRequestContext,
  unitId: string
): Promise<PublicUnitDetail> {
  const response = await request.get(apiUrl(`/api/units/${unitId}`));
  return unwrapResponse<PublicUnitDetail>(response, "Get public unit detail");
}

export async function getUnitImages(
  request: APIRequestContext,
  unitId: string
): Promise<UnitImageResponse[]> {
  const response = await request.get(apiUrl(`/api/units/${unitId}/images`));
  return unwrapResponse<UnitImageResponse[]>(response, "Get public unit images");
}

export async function getPublicReviewSummary(
  request: APIRequestContext,
  unitId: string
): Promise<PublicReviewSummary> {
  const response = await request.get(
    apiUrl(`/api/public/units/${unitId}/reviews/summary`)
  );
  return unwrapResponse<PublicReviewSummary>(
    response,
    "Get public review summary"
  );
}

export async function calculatePricing(
  request: APIRequestContext,
  unitId: string,
  startDate: string,
  endDate: string
): Promise<{ totalPrice: number; nights: Array<{ date: string; pricePerNight: number }> }> {
  const response = await request.post(
    apiUrl(`/api/units/${unitId}/pricing/calculate`),
    { data: { startDate, endDate } }
  );
  return unwrapResponse(response, "Calculate public unit pricing");
}

export async function checkAvailability(
  request: APIRequestContext,
  unitId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityResponse> {
  const response = await request.post(
    apiUrl(`/api/units/${unitId}/availability/operational-check`),
    { data: { startDate, endDate } }
  );
  return unwrapResponse<AvailabilityResponse>(response, "Check availability");
}

export async function getClientBookings(
  request: APIRequestContext,
  clientToken: string
): Promise<PaginatedResult<BookingListItem>> {
  const response = await request.get(
    apiUrl("/api/client/bookings?page=1&pageSize=100"),
    { headers: authHeaders(clientToken) }
  );
  return unwrapPaginatedResponse<BookingListItem>(
    response,
    "Get client bookings"
  );
}

export async function getClientBookingDetail(
  request: APIRequestContext,
  clientToken: string,
  bookingId: string
): Promise<BookingDetails> {
  const response = await request.get(apiUrl(`/api/client/bookings/${bookingId}`), {
    headers: authHeaders(clientToken),
  });
  return unwrapResponse<BookingDetails>(response, "Get client booking detail");
}

export async function getInternalLead(
  request: APIRequestContext,
  adminToken: string,
  leadId: string
): Promise<CrmLeadDetails> {
  const response = await request.get(apiUrl(`/api/internal/crm/leads/${leadId}`), {
    headers: authHeaders(adminToken),
  });
  return unwrapResponse<CrmLeadDetails>(response, "Get internal CRM lead");
}

export async function updateLeadStatus(
  request: APIRequestContext,
  adminToken: string,
  leadId: string,
  leadStatus: "Contacted" | "Qualified" | "Lost"
): Promise<boolean> {
  const response = await request.patch(
    apiUrl(`/api/internal/crm/leads/${leadId}/status`),
    {
      headers: authHeaders(adminToken),
      data: { leadStatus },
    }
  );
  return response.ok();
}

export async function getInternalBookings(
  request: APIRequestContext,
  adminToken: string,
  params?: Record<string, string | number | undefined>
): Promise<PaginatedResult<BookingListItem>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const suffix = search.toString() ? `?${search}` : "";
  const response = await request.get(apiUrl(`/api/internal/bookings${suffix}`), {
    headers: authHeaders(adminToken),
  });
  return unwrapPaginatedResponse<BookingListItem>(
    response,
    "Get internal bookings"
  );
}

export async function createInternalBooking<T = BookingDetails>(
  request: APIRequestContext,
  adminToken: string,
  bookingData: unknown
): Promise<T> {
  const response = await request.post(apiUrl("/api/internal/bookings"), {
    headers: authHeaders(adminToken),
    data: bookingData,
  });
  return unwrapResponse<T>(response, "Create internal booking");
}

export async function transitionBooking(
  request: APIRequestContext,
  adminToken: string,
  bookingId: string,
  transition:
    | "booked"
    | "confirm"
    | "check-in"
    | "complete"
    | "cancel"
    | "not-relevant"
): Promise<boolean> {
  const response = await request.post(
    apiUrl(`/api/internal/bookings/${bookingId}/${transition}`),
    {
      headers: authHeaders(adminToken),
      data: { notes: "Client smoke cleanup/progression" },
    }
  );
  return response.ok() || response.status() === 409 || response.status() === 404;
}

export async function createPayment<T = { id: string }>(
  request: APIRequestContext,
  adminToken: string,
  paymentData: unknown
): Promise<T> {
  const response = await request.post(apiUrl("/api/internal/payments"), {
    headers: authHeaders(adminToken),
    data: paymentData,
  });
  return unwrapResponse<T>(response, "Create payment");
}

export async function getPaymentsByBooking<T extends { id: string }>(
  request: APIRequestContext,
  adminToken: string,
  bookingId: string
): Promise<PaginatedResult<T>> {
  const response = await request.get(
    apiUrl(`/api/internal/payments?bookingId=${bookingId}&page=1&pageSize=50`),
    { headers: authHeaders(adminToken) }
  );
  return unwrapPaginatedResponse<T>(response, "Get payments by booking");
}

export async function cancelPayment(
  request: APIRequestContext,
  adminToken: string,
  paymentId: string
): Promise<boolean> {
  const response = await request.post(
    apiUrl(`/api/internal/payments/${paymentId}/cancel`),
    {
      headers: authHeaders(adminToken),
      data: { notes: "Client smoke cleanup" },
    }
  );
  return response.ok() || response.status() === 409 || response.status() === 404;
}

export async function deactivateClient(
  request: APIRequestContext,
  adminToken: string,
  clientId: string
): Promise<boolean> {
  const response = await request.patch(apiUrl(`/api/clients/${clientId}/status`), {
    headers: authHeaders(adminToken),
    data: { isActive: false },
  });
  return response.ok() || response.status() === 404;
}

export async function getClients(
  request: APIRequestContext,
  adminToken: string,
  search: string
): Promise<PaginatedResult<ClientListItem>> {
  const params = new URLSearchParams({
    includeInactive: "true",
    page: "1",
    pageSize: "200",
    search,
  });
  const response = await request.get(apiUrl(`/api/clients?${params}`), {
    headers: authHeaders(adminToken),
  });
  return unwrapPaginatedResponse<ClientListItem>(response, "Get clients");
}

export async function getInternalUnits(
  request: APIRequestContext,
  adminToken: string
): Promise<InternalUnitResponse[]> {
  const response = await request.get(
    apiUrl("/api/internal/units?page=1&pageSize=500&includeInactive=true"),
    { headers: authHeaders(adminToken) }
  );
  const result = await unwrapPaginatedResponse<InternalUnitResponse>(
    response,
    "Get internal units"
  );
  return result.items;
}

export async function getAreas(
  request: APIRequestContext,
  adminToken: string
): Promise<AreaResponse[]> {
  const response = await request.get(apiUrl("/api/areas?includeInactive=true"), {
    headers: authHeaders(adminToken),
  });
  return unwrapResponse<AreaResponse[]>(response, "Get areas");
}

export async function getClientReviewByBooking(
  request: APIRequestContext,
  clientToken: string,
  bookingId: string
): Promise<ReviewResponse | null> {
  const response = await request.get(
    apiUrl(`/api/client/reviews/by-booking/${bookingId}`),
    { headers: authHeaders(clientToken) }
  );
  if (response.status() === 404) return null;
  return unwrapResponse<ReviewResponse>(response, "Get client review by booking");
}

export async function getClientNotifications(
  request: APIRequestContext,
  clientToken: string
): Promise<NotificationListItem[]> {
  const response = await request.get(
    apiUrl("/api/client/me/notifications/inbox?page=1&pageSize=50"),
    { headers: authHeaders(clientToken) }
  );
  return unwrapResponse<NotificationListItem[]>(
    response,
    "Get client notifications"
  );
}

export async function createClientBookingNotification(
  request: APIRequestContext,
  adminToken: string,
  clientId: string,
  finalAmount: string
): Promise<NotificationResponse> {
  const response = await request.post(
    apiUrl(`/api/internal/notifications/clients/${clientId}`),
    {
      headers: authHeaders(adminToken),
      data: {
        templateCode: "CLIENT_BOOKING_CONFIRMED",
        channel: "in_app",
        variables: { finalAmount },
      },
    }
  );
  return unwrapResponse<NotificationResponse>(
    response,
    "Create client booking notification"
  );
}

export async function assertForbiddenOrNotFound(response: APIResponse): Promise<void> {
  expect([403, 404]).toContain(response.status());
  const body = (await response.json()) as ApiEnvelope<unknown>;
  expect(body.success).toBe(false);
}
