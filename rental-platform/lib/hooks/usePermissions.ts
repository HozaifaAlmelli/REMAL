import { useMemo } from "react";
import { useAuthStore } from "@/lib/stores/auth.store";

export interface Permissions {
  isAdmin: boolean;
  isOwner: boolean;
  isClient: boolean;

  canViewCRM: boolean;
  canManageCRM: boolean;
  canAssignLeads: boolean;
  canViewBookings: boolean;
  canViewFinance: boolean;
  canManageFinance: boolean;
  canManagePayouts: boolean;
  canManageBookings: boolean;
  canViewUnits: boolean;
  canViewOwners: boolean;
  canManageOwners: boolean;
  canViewClients: boolean;
  canManageClients: boolean;
  canResetClientPasswords: boolean;
  canModerateReviews: boolean;
  canManageAdminUsers: boolean;
  canManageProjects: boolean;
  canManageAmenities: boolean;
  canManageUnits: boolean;
  canViewReports: boolean;
  canApproveBlocks: boolean;
}

export function usePermissions(): Permissions {
  const subjectType = useAuthStore((s) => s.subjectType);
  const serverPermissions = useAuthStore((s) => s.permissions);

  return useMemo(() => {
    const isAdmin = subjectType === "Admin";
    const isOwner = subjectType === "Owner";
    const isClient = subjectType === "Client";

    const grants = new Set(serverPermissions);

    // Each UI capability maps to the backend policy that guards its endpoints,
    // so what the UI shows and what the API allows cannot drift.
    const has = (permission: string) => isAdmin && grants.has(permission);

    return {
      isAdmin,
      isOwner,
      isClient,

      canViewCRM: has("crm:read"),
      canManageCRM: has("crm:write"),
      canAssignLeads: has("crm:assign"),
      canViewBookings: has("bookings:read"),
      canViewFinance: has("finance:overview"),
      canManageFinance: has("finance:manage"),
      canManagePayouts: has("finance:payouts"),
      canManageBookings: has("bookings:write"),
      canViewUnits: has("units:read"),
      canViewOwners: has("owners:read"),
      canManageOwners: has("owners:manage"),
      canViewClients: has("clients:read"),
      canManageClients: has("clients:write"),
      canResetClientPasswords: has("clients:reset_password"),
      canModerateReviews: has("reviews:moderate"),
      canManageAdminUsers: has("settings:admin"),
      canManageProjects: has("projects:manage"),
      canManageAmenities: has("amenities:manage"),
      canManageUnits: has("units:manage"),
      canViewReports: has("analytics:read"),
      canApproveBlocks: has("availability:approve"),
    };
  }, [subjectType, serverPermissions]);
}
