import {
  CRM_LEAD_STATUSES,
  type CrmLeadStatus,
} from "@/lib/constants/booking-statuses";
import type { CrmLeadListItemResponse } from "@/lib/types/crm.types";

export const CRM_VIEWS = {
  Pipeline: "pipeline",
  List: "list",
} as const;

export type CrmView = (typeof CRM_VIEWS)[keyof typeof CRM_VIEWS];

export interface CrmLeadFilterState {
  search: string;
  status: CrmLeadStatus | "";
  source: string;
  ownerId: string;
}

export function normalizeCrmView(value: string | null): CrmView {
  return value === CRM_VIEWS.List ? CRM_VIEWS.List : CRM_VIEWS.Pipeline;
}

export function normalizeCrmStatus(value: string | null): CrmLeadStatus | "" {
  return value &&
    Object.values(CRM_LEAD_STATUSES).includes(value as CrmLeadStatus)
    ? (value as CrmLeadStatus)
    : "";
}

export function filterCrmLeads(
  leads: CrmLeadListItemResponse[],
  filters: CrmLeadFilterState
): CrmLeadListItemResponse[] {
  const search = filters.search.trim().toLocaleLowerCase();

  return leads.filter((lead) => {
    if (filters.status && lead.leadStatus !== filters.status) return false;
    if (filters.source && lead.source !== filters.source) return false;

    if (filters.ownerId === "unassigned" && lead.assignedAdminUserId !== null) {
      return false;
    }

    if (
      filters.ownerId &&
      filters.ownerId !== "unassigned" &&
      lead.assignedAdminUserId !== filters.ownerId
    ) {
      return false;
    }

    if (!search) return true;

    return [
      lead.contactName,
      lead.contactPhone,
      lead.contactEmail,
      lead.targetUnitName,
    ].some((value) => value?.toLocaleLowerCase().includes(search));
  });
}
