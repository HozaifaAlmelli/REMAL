import { APIRequestContext } from "@playwright/test";
import { ADMIN_USERS } from "../fixtures/test-data";

/**
 * Retrieve the JWT access token for a given admin user role.
 */
export async function getApiToken(request: APIRequestContext, role: keyof typeof ADMIN_USERS = "SuperAdmin"): Promise<string> {
  const credentials = ADMIN_USERS[role];
  const response = await request.post("http://localhost:5001/api/auth/admin/login", {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to login as admin: ${response.statusText()}`);
  }
  
  const body = await response.json();
  return body.data.accessToken;
}

/**
 * Create a new Area via API.
 */
export async function createTestArea(request: APIRequestContext, token: string, areaData: { name: string; description: string; isActive: boolean }) {
  const response = await request.post("http://localhost:5001/api/areas", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: areaData,
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create area: ${await response.text()}`);
  }
  
  const body = await response.json();
  return body.data; // Returns created area object containing id
}

/**
 * Delete an Area via API.
 */
export async function deleteTestArea(request: APIRequestContext, token: string, areaId: string) {
  const response = await request.delete(`http://localhost:5001/api/areas/${areaId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  return response.ok();
}

/**
 * Create a new Unit via API.
 */
export async function createTestUnit(request: APIRequestContext, token: string, unitData: any) {
  const response = await request.post("http://localhost:5001/api/internal/units", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: unitData,
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create unit: ${await response.text()}`);
  }
  
  const body = await response.json();
  return body.data; // Returns created unit object containing id
}

/**
 * Delete a Unit via API.
 */
export async function deleteTestUnit(request: APIRequestContext, token: string, unitId: string) {
  const response = await request.delete(`http://localhost:5001/api/internal/units/${unitId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  return response.ok();
}

/**
 * Create a new CRM Lead via API.
 */
export async function createTestLead(request: APIRequestContext, token: string, leadData: any) {
  const response = await request.post("http://localhost:5001/api/internal/crm/leads", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: leadData,
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create lead: ${await response.text()}`);
  }
  
  const body = await response.json();
  return body.data; // Returns created lead object containing id
}

/**
 * Create a Date Block for a Unit via API.
 */
export async function createDateBlock(request: APIRequestContext, token: string, unitId: string, blockData: { startDate: string; endDate: string; reason: string; notes?: string }) {
  const response = await request.post(`http://localhost:5001/api/internal/units/${unitId}/date-blocks`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: blockData,
  });

  if (!response.ok()) {
    throw new Error(`Failed to create date block: ${await response.text()}`);
  }

  const body = await response.json();
  return body.data;
}
