import { ApiError } from "@/lib/api/api-error";

export const SUPERADMIN_ROLE_TEMPLATE_ID =
  "10000000-0000-0000-0000-000000000001";

export const HISTORICAL_PERMISSION_KEYS = {
  booking: "bookings:record_historical",
  payment: "payments:record_historical",
  correction: "bookings:correct_owner_attribution",
} as const;

const SUPERADMIN_BASELINE = new Set<string>(Object.values(HISTORICAL_PERMISSION_KEYS));

export function normalizeHistoricalRolePermissions(
  roleTemplateId: string,
  permissionKeys: readonly string[]
): string[] {
  const normalized = new Set(permissionKeys);
  if (roleTemplateId === SUPERADMIN_ROLE_TEMPLATE_ID) {
    for (const key of SUPERADMIN_BASELINE) normalized.add(key);
  } else {
    normalized.delete(HISTORICAL_PERMISSION_KEYS.correction);
  }
  return [...normalized];
}

export function historicalRolePermissionState(
  roleTemplateId: string,
  permissionKey: string,
  selected: boolean
): { checked: boolean; disabled: boolean; helperText: string | null } {
  const isSuperAdmin = roleTemplateId === SUPERADMIN_ROLE_TEMPLATE_ID;
  if (isSuperAdmin && SUPERADMIN_BASELINE.has(permissionKey)) {
    return {
      checked: true,
      disabled: true,
      helperText: "Mandatory SuperAdmin baseline permission.",
    };
  }
  if (!isSuperAdmin && permissionKey === HISTORICAL_PERMISSION_KEYS.correction) {
    return {
      checked: false,
      disabled: true,
      helperText: "Restricted to the SuperAdmin role.",
    };
  }
  return { checked: selected, disabled: false, helperText: null };
}

export function isOwnerCorrectionOverrideProtected(permissionKey: string): boolean {
  return permissionKey === HISTORICAL_PERMISSION_KEYS.correction;
}

export function rbacMutationErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === "RBAC_HISTORICAL_SUPERADMIN_BASELINE_REQUIRED") {
    return "The SuperAdmin historical-booking baseline permissions are mandatory.";
  }
  if (error.code === "RBAC_OWNER_CORRECTION_SUPERADMIN_ONLY") {
    return "Historical owner-attribution correction is restricted to SuperAdmin.";
  }
  return fallback;
}
