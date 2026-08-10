import { expect, test, type Page, type Route } from "@playwright/test";

const SUPERADMIN_ID = "10000000-0000-0000-0000-000000000001";
const SALES_ID = "10000000-0000-0000-0000-000000000002";
const ACTOR_ID = "20000000-0000-4000-8000-000000000001";
const SALES_USER_ID = "20000000-0000-4000-8000-000000000002";
const BOOKING = "bookings:record_historical";
const PAYMENT = "payments:record_historical";
const CORRECTION = "bookings:correct_owner_attribution";
const BOOKINGS_WRITE = "bookings:write";

const cors = {
  "access-control-allow-origin": "http://localhost:3103",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

interface RoleFixtureState {
  roles: Array<{
    id: string;
    name: string;
    description: string;
    isSystem: boolean;
    isActive: boolean;
    permissions: string[];
    assignedUserCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  updates: Array<{ roleId: string; body: { permissionKeys: string[] } }>;
  invalidations: number;
  rejectNextUpdate: boolean;
}

async function envelope(
  route: Route,
  data: unknown,
  options: { status?: number; code?: string; errors?: string[]; pagination?: unknown } = {}
) {
  const status = options.status ?? 200;
  await route.fulfill({
    status,
    headers: { ...cors, "content-type": "application/json" },
    body: JSON.stringify({
      success: status < 400,
      data: status < 400 ? data : null,
      message: status < 400 ? null : "Validation failed",
      errors: options.errors ?? [],
      code: options.code ?? null,
      metadata: null,
      pagination: options.pagination ?? null,
    }),
  });
}

async function installRoleAccessApi(page: Page): Promise<RoleFixtureState> {
  const state: RoleFixtureState = {
    roles: [
      {
        id: SUPERADMIN_ID,
        name: "SuperAdmin",
        description: "Full platform administration.",
        isSystem: true,
        isActive: true,
        permissions: [BOOKING, PAYMENT, CORRECTION, BOOKINGS_WRITE, "settings:admin"],
        assignedUserCount: 2,
        createdAt: "2026-08-09T10:00:00Z",
        updatedAt: "2026-08-09T10:00:00Z",
      },
      {
        id: SALES_ID,
        name: "Sales",
        description: "Sales operations.",
        isSystem: true,
        isActive: true,
        permissions: [BOOKINGS_WRITE, "bookings:read", "units:read", "clients:read"],
        assignedUserCount: 1,
        createdAt: "2026-08-09T10:00:00Z",
        updatedAt: "2026-08-09T10:00:00Z",
      },
    ],
    updates: [],
    invalidations: 0,
    rejectNextUpdate: false,
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.pathname === "/api/auth/refresh") {
      await envelope(route, {
        accessToken: "sanitized-access-token",
        expiresInSeconds: 3600,
        subjectType: "Admin",
        adminRole: "SuperAdmin",
        roleName: "SuperAdmin",
        user: {
          userId: ACTOR_ID,
          identifier: "operator@example.test",
          subjectType: "Admin",
          adminRole: "SuperAdmin",
          name: "RBAC Operator",
        },
        permissions: ["settings:admin", "bookings:read"],
      });
      return;
    }
    if (url.pathname === "/api/internal/me/notifications/inbox/summary") {
      await envelope(route, { totalCount: 0, unreadCount: 0, readCount: 0 });
      return;
    }
    if (url.pathname === "/api/internal/security/permissions") {
      await envelope(route, permissionGroups());
      return;
    }
    if (url.pathname === "/api/internal/security/roles" && request.method() === "GET") {
      await envelope(route, state.roles);
      return;
    }
    if (url.pathname.startsWith("/api/internal/security/roles/") && request.method() === "PUT") {
      const roleId = url.pathname.split("/").at(-1)!;
      const body = request.postDataJSON() as { permissionKeys: string[] };
      state.updates.push({ roleId, body });
      if (state.rejectNextUpdate || (roleId !== SUPERADMIN_ID && body.permissionKeys.includes(CORRECTION))) {
        state.rejectNextUpdate = false;
        await envelope(route, null, {
          status: 400,
          code: "RBAC_OWNER_CORRECTION_SUPERADMIN_ONLY",
          errors: ["Historical owner-attribution correction is restricted to SuperAdmin."],
        });
        return;
      }
      const role = state.roles.find((entry) => entry.id === roleId)!;
      role.permissions = [...body.permissionKeys];
      role.updatedAt = "2026-08-09T10:05:00Z";
      state.invalidations += 1;
      await envelope(route, role);
      return;
    }
    if (url.pathname === "/api/admin-users") {
      await envelope(
        route,
        [
          {
            id: ACTOR_ID,
            name: "RBAC Operator",
            email: "operator@example.test",
            role: "SuperAdmin",
            roleTemplateId: SUPERADMIN_ID,
            roleName: "SuperAdmin",
            isActive: true,
            createdAt: "2026-08-09T10:00:00Z",
            updatedAt: "2026-08-09T10:00:00Z",
          },
          {
            id: SALES_USER_ID,
            name: "Sales Operator",
            email: "sales@example.test",
            role: "Sales",
            roleTemplateId: SALES_ID,
            roleName: "Sales",
            isActive: true,
            createdAt: "2026-08-09T10:00:00Z",
            updatedAt: "2026-08-09T10:00:00Z",
          },
        ],
        { pagination: { totalCount: 2, page: 1, pageSize: 20, totalPages: 1 } }
      );
      return;
    }
    if (url.pathname === `/api/internal/security/users/${SALES_USER_ID}/overrides`) {
      await envelope(route, {
        adminUserId: SALES_USER_ID,
        effective: [BOOKINGS_WRITE],
        inherited: [BOOKINGS_WRITE],
        grants: [],
        denies: [],
      });
      return;
    }
    if (url.pathname === "/api/internal/me/notification-preferences") {
      await envelope(route, []);
      return;
    }
    await envelope(route, null, { status: 404 });
  });
  return state;
}

function permissionGroups() {
  return [
    {
      module: "Bookings",
      permissions: [
        {
          key: "bookings:read",
          module: "Bookings",
          label: "View bookings",
          description: "View bookings and status history.",
        },
        {
          key: BOOKINGS_WRITE,
          module: "Bookings",
          label: "Manage bookings",
          description: "Create and update ordinary bookings.",
        },
        {
          key: BOOKING,
          module: "Bookings",
          label: "Record historical bookings",
          description:
            "Unit selection requires View units. Existing-client selection requires View clients; new-client entry remains available without it. Owner attribution review requires View bookings. Optional historical payment requires Record historical payments. These permissions are granted independently.",
        },
        {
          key: CORRECTION,
          module: "Bookings",
          label: "Correct historical owner attribution",
          description: "Restricted owner correction with immutable audit.",
        },
      ],
    },
    {
      module: "Finance",
      permissions: [
        {
          key: PAYMENT,
          module: "Finance",
          label: "Record historical payments",
          description: "Record immutable external-payment evidence.",
        },
      ],
    },
  ];
}

test("Role Access protects SuperAdmin baselines and explains independent dependencies", async ({ page }) => {
  await installRoleAccessApi(page);
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: /SuperAdmin/ }).click();

  for (const label of [
    "Record historical bookings for SuperAdmin",
    "Record historical payments for SuperAdmin",
    "Correct historical owner attribution for SuperAdmin",
  ]) {
    const control = page.getByRole("switch", { name: label });
    await expect(control).toBeChecked();
    await expect(control).toBeDisabled();
  }
  await expect(page.getByText("Unit selection requires View units.", { exact: false })).toBeVisible();
  await expect(page.getByText("Existing-client selection requires View clients", { exact: false })).toBeVisible();
  await expect(page.getByText("new-client entry remains available", { exact: false })).toBeVisible();
  await expect(page.getByText("Owner attribution review requires View bookings", { exact: false })).toBeVisible();
  await expect(page.getByText("Optional historical payment requires Record historical payments", { exact: false })).toBeVisible();
  await expect(page.getByText(BOOKING, { exact: true })).toHaveCount(0);
});

test("non-SuperAdmin creation and payment grants remain independent while correction is disabled", async ({ page }) => {
  const state = await installRoleAccessApi(page);
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: /Sales/ }).click();

  const booking = page.getByRole("switch", { name: "Record historical bookings for Sales" });
  const payment = page.getByRole("switch", { name: "Record historical payments for Sales" });
  const correction = page.getByRole("switch", { name: "Correct historical owner attribution for Sales" });
  await expect(booking).toBeEnabled();
  await expect(payment).toBeEnabled();
  await expect(correction).not.toBeChecked();
  await expect(correction).toBeDisabled();

  await booking.click();
  await page.getByRole("button", { name: "Save access" }).click();
  await expect(page.getByText(/will be signed out on their next action/)).toBeVisible();
  expect(state.invalidations).toBe(1);
  expect(state.updates[0]!.body.permissionKeys).toContain(BOOKING);
  expect(state.updates[0]!.body.permissionKeys).not.toContain(PAYMENT);
  expect(state.updates[0]!.body.permissionKeys).not.toContain(CORRECTION);
  expect(state.updates[0]!.body.permissionKeys).toContain(BOOKINGS_WRITE);
});

test("rejected invariant updates show a safe error and restore server state", async ({ page }) => {
  const state = await installRoleAccessApi(page);
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: /Sales/ }).click();
  const booking = page.getByRole("switch", { name: "Record historical bookings for Sales" });
  await booking.click();
  state.rejectNextUpdate = true;
  await page.getByRole("button", { name: "Save access" }).click();

  await expect(page.getByText("Historical owner-attribution correction is restricted to SuperAdmin.")).toBeVisible();
  await expect(booking).not.toBeChecked();
  await expect(page.getByText(/will be signed out on their next action/)).toHaveCount(0);
  expect(state.invalidations).toBe(0);

  const apiResult = await page.evaluate(async ({ salesId, correction }) => {
    const response = await fetch(`http://historical-fixture.local/api/internal/security/roles/${salesId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Sales",
        description: "Sales operations.",
        permissionKeys: [correction],
      }),
    });
    return { status: response.status, body: await response.json() };
  }, { salesId: SALES_ID, correction: CORRECTION });
  expect(apiResult.status).toBe(400);
  expect(apiResult.body.code).toBe("RBAC_OWNER_CORRECTION_SUPERADMIN_ONLY");
  expect(state.invalidations).toBe(0);
});
