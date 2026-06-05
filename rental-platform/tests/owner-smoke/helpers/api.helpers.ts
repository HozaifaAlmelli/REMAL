import { APIRequestContext, APIResponse } from "@playwright/test";
import { ADMIN_USERS, OWNER_USERS } from "../fixtures/test-data";
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

export interface CreateTestAreaInput {
  name: string;
  description: string;
  isActive: boolean;
}

export interface CreateTestLeadInput {
  clientId?: string;
  targetUnitId?: string;
  assignedAdminUserId?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  source: string;
  desiredCheckInDate: string;
  desiredCheckOutDate: string;
  guestCount: number;
  notes?: string;
}

export interface ConvertLeadToBookingInput {
  clientId: string;
  unitId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  internalNotes?: string;
}

export interface CreateOwnerPayoutInput {
  bookingId: string;
  commissionRate: number;
  proofOfPaymentUrl?: string | null;
  notes?: string;
}

export interface OwnerFinanceSummary {
  ownerId: string;
  totalInvoicedAmount: number;
  totalPaidAmount: number;
  totalRemainingAmount: number;
  totalPendingPayoutAmount: number;
  totalScheduledPayoutAmount: number;
  totalPaidPayoutAmount: number;
}

export interface OwnerDashboardSummary {
  ownerId: string;
  totalUnits: number;
  activeUnits: number;
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  totalPaidAmount: number;
  totalPendingPayoutAmount: number;
  totalPaidPayoutAmount: number;
}

function authHeaders(token: string): Record<string, string> {
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
      `${label} returned failure envelope: ${body.message ?? "Request failed"}`
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
  const body = (await response.json()) as ApiEnvelope<T[]>;
  if (!response.ok() || body.success === false) {
    throw new Error(
      `${label} failed with ${response.status()}: ${body.message ?? (await responseText(response))}`
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
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });

  const body = await unwrapResponse<{ accessToken: string }>(
    response,
    `Login as admin ${role}`
  );
  return body.accessToken;
}

export async function getOwnerApiToken(
  request: APIRequestContext,
  ownerKey: keyof typeof OWNER_USERS = "OwnerA"
): Promise<string> {
  const credentials = OWNER_USERS[ownerKey];
  const response = await request.post(apiUrl("/api/auth/owner/login"), {
    data: {
      phone: credentials.phone,
      password: credentials.password,
    },
  });

  const body = await unwrapResponse<{ accessToken: string }>(
    response,
    `Login as owner ${ownerKey}`
  );
  return body.accessToken;
}

export async function createTestArea(
  request: APIRequestContext,
  token: string,
  areaData: CreateTestAreaInput
): Promise<{ id: string; name: string; isActive: boolean }> {
  const response = await request.post(apiUrl("/api/areas"), {
    headers: authHeaders(token),
    data: areaData,
  });
  return unwrapResponse(response, "Create test area");
}

export async function getAreas<T>(
  request: APIRequestContext,
  token: string,
  includeInactive = false
): Promise<T[]> {
  const response = await request.get(
    apiUrl(`/api/areas?includeInactive=${includeInactive ? "true" : "false"}`),
    { headers: authHeaders(token) }
  );
  return unwrapResponse<T[]>(response, "Get areas");
}

export async function deactivateTestArea(
  request: APIRequestContext,
  token: string,
  areaId: string
): Promise<boolean> {
  const response = await request.patch(apiUrl(`/api/areas/${areaId}/status`), {
    headers: authHeaders(token),
    data: { isActive: false },
  });
  return response.ok();
}

export async function deleteTestArea(
  request: APIRequestContext,
  token: string,
  areaId: string
): Promise<boolean> {
  return deactivateTestArea(request, token, areaId);
}

export async function createTestUnit<T = { id: string }>(
  request: APIRequestContext,
  token: string,
  unitData: unknown
): Promise<T> {
  const response = await request.post(apiUrl("/api/internal/units"), {
    headers: authHeaders(token),
    data: unitData,
  });
  return unwrapResponse<T>(response, "Create test unit");
}

export async function getInternalUnits<T>(
  request: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    pageSize?: number;
    includeInactive?: boolean;
    ownerId?: string;
  }
): Promise<T[]> {
  const search = new URLSearchParams();
  search.set("page", String(params?.page ?? 1));
  search.set("pageSize", String(params?.pageSize ?? 100));
  search.set("includeInactive", String(params?.includeInactive ?? true));
  if (params?.ownerId) search.set("ownerId", params.ownerId);

  const response = await request.get(apiUrl(`/api/internal/units?${search}`), {
    headers: authHeaders(token),
  });
  const result = await unwrapPaginatedResponse<T>(response, "Get internal units");
  return result.items;
}

export async function deleteTestUnit(
  request: APIRequestContext,
  token: string,
  unitId: string
): Promise<boolean> {
  const response = await request.delete(apiUrl(`/api/internal/units/${unitId}`), {
    headers: authHeaders(token),
  });
  return response.ok() || response.status() === 404;
}

export async function createTestLead<T = { id: string }>(
  request: APIRequestContext,
  token: string,
  leadData: CreateTestLeadInput
): Promise<T> {
  const response = await request.post(apiUrl("/api/internal/crm/leads"), {
    headers: authHeaders(token),
    data: leadData,
  });
  return unwrapResponse<T>(response, "Create test CRM lead");
}

export async function setLeadStatus<T = { id: string; leadStatus: string }>(
  request: APIRequestContext,
  token: string,
  leadId: string,
  leadStatus: "Contacted" | "Qualified" | "Lost"
): Promise<T> {
  const response = await request.patch(
    apiUrl(`/api/internal/crm/leads/${leadId}/status`),
    {
      headers: authHeaders(token),
      data: { leadStatus },
    }
  );
  return unwrapResponse<T>(response, `Set lead ${leadId} to ${leadStatus}`);
}

export async function qualifyLead(
  request: APIRequestContext,
  token: string,
  leadId: string
): Promise<void> {
  await setLeadStatus(request, token, leadId, "Contacted");
  await setLeadStatus(request, token, leadId, "Qualified");
}

export async function convertLeadToBooking<T = { id: string }>(
  request: APIRequestContext,
  token: string,
  leadId: string,
  conversion: ConvertLeadToBookingInput
): Promise<T> {
  const response = await request.post(
    apiUrl(`/api/internal/crm/leads/${leadId}/convert-to-booking`),
    {
      headers: authHeaders(token),
      data: conversion,
    }
  );
  return unwrapResponse<T>(response, "Convert lead to booking");
}

export async function markBookingBooked<T = { id: string; bookingStatus: string }>(
  request: APIRequestContext,
  token: string,
  bookingId: string
): Promise<T> {
  const response = await request.post(
    apiUrl(`/api/internal/bookings/${bookingId}/booked`),
    {
      headers: authHeaders(token),
      data: { notes: "Owner smoke test booked transition" },
    }
  );
  return unwrapResponse<T>(response, "Mark booking booked");
}

export async function confirmBooking<T = { id: string; bookingStatus: string }>(
  request: APIRequestContext,
  token: string,
  bookingId: string
): Promise<T> {
  const response = await request.post(
    apiUrl(`/api/internal/bookings/${bookingId}/confirm`),
    {
      headers: authHeaders(token),
      data: { notes: "Owner smoke test confirmation" },
    }
  );
  return unwrapResponse<T>(response, "Confirm booking");
}

export async function cancelBooking(
  request: APIRequestContext,
  token: string,
  bookingId: string
): Promise<boolean> {
  const response = await request.post(
    apiUrl(`/api/internal/bookings/${bookingId}/cancel`),
    {
      headers: authHeaders(token),
      data: { notes: "Owner smoke test cleanup cancellation" },
    }
  );
  return response.ok() || response.status() === 409 || response.status() === 404;
}

export async function createTestPayment<T>(
  request: APIRequestContext,
  token: string,
  paymentData: unknown
): Promise<T> {
  const response = await request.post(apiUrl("/api/internal/payments"), {
    headers: authHeaders(token),
    data: paymentData,
  });
  return unwrapResponse<T>(response, "Create test payment");
}

export async function createOwnerPayout<T = { id: string; payoutAmount: number }>(
  request: APIRequestContext,
  token: string,
  payoutData: CreateOwnerPayoutInput
): Promise<T> {
  const response = await request.post(apiUrl("/api/internal/owner-payouts"), {
    headers: authHeaders(token),
    data: payoutData,
  });
  return unwrapResponse<T>(response, "Create owner payout");
}

export async function cancelOwnerPayout(
  request: APIRequestContext,
  token: string,
  payoutId: string
): Promise<boolean> {
  const response = await request.post(
    apiUrl(`/api/internal/owner-payouts/${payoutId}/cancel`),
    {
      headers: authHeaders(token),
      data: { notes: "Owner smoke test cleanup cancellation" },
    }
  );
  return response.ok() || response.status() === 409 || response.status() === 404;
}

export async function getOwnerDashboardSummary(
  request: APIRequestContext,
  ownerToken: string
): Promise<OwnerDashboardSummary> {
  const response = await request.get(apiUrl("/api/owner/dashboard"), {
    headers: authHeaders(ownerToken),
  });
  return unwrapResponse(response, "Get owner dashboard summary");
}

export async function getOwnerFinanceSummary(
  request: APIRequestContext,
  ownerToken: string
): Promise<OwnerFinanceSummary> {
  const response = await request.get(apiUrl("/api/owner/finance/summary"), {
    headers: authHeaders(ownerToken),
  });
  return unwrapResponse(response, "Get owner finance summary");
}

export async function getOwnerFinanceRowByBooking<T>(
  request: APIRequestContext,
  ownerToken: string,
  bookingId: string
): Promise<T> {
  const response = await request.get(
    apiUrl(`/api/owner/finance/bookings/${bookingId}`),
    {
      headers: authHeaders(ownerToken),
    }
  );
  return unwrapResponse<T>(response, "Get owner finance row by booking");
}

export async function checkOwnerAvailability<T>(
  request: APIRequestContext,
  ownerToken: string,
  unitId: string,
  startDate: string,
  endDate: string
): Promise<T> {
  const response = await request.post(
    apiUrl(`/api/units/${unitId}/availability/operational-check`),
    {
      headers: authHeaders(ownerToken),
      data: { startDate, endDate },
    }
  );
  return unwrapResponse<T>(response, "Check owner unit availability");
}

