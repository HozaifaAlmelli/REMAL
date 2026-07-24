"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import {
  CRM_STATUS_LABELS,
  type CrmLeadStatus,
} from "@/lib/constants/booking-statuses";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import type {
  CrmAssigneeResponse,
  CrmLeadListItemResponse,
} from "@/lib/types/crm.types";
import { ROUTES } from "@/lib/constants/routes";
import { formatDate, formatDateRange, maskPhone } from "@/lib/utils/format";
import type { PaginationMeta } from "@/lib/api/types";

const LIST_PAGE_SIZE = 25;
const listColumns = [
  { label: "Lead", className: "w-[230px]" },
  { label: "Stage", className: "w-[105px]" },
  { label: "Source", className: "w-[105px]" },
  { label: "Assigned owner", className: "w-[170px]" },
  { label: "Requested stay", className: "w-[205px]" },
  { label: "Created", className: "w-[115px]" },
  { label: "Actions", className: "w-[85px]" },
] as const;

interface CrmLeadListViewProps {
  leads: CrmLeadListItemResponse[];
  assignees: CrmAssigneeResponse[];
  page: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

function sourceLabel(source: string): string {
  return (
    BOOKING_SOURCE_LABELS[source as keyof typeof BOOKING_SOURCE_LABELS] ??
    source
  );
}

function statusVariant(
  status: CrmLeadStatus
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "Prospecting":
    case "NoAnswer":
      return "warning";
    case "Relevant":
    case "Booked":
      return "info";
    case "Completed":
      return "success";
    case "Cancelled":
    case "LeftEarly":
      return "danger";
    default:
      return "neutral";
  }
}

export function CrmLeadListView({
  leads,
  assignees,
  page,
  isLoading,
  onPageChange,
}: CrmLeadListViewProps) {
  const router = useRouter();
  const assigneeNames = useMemo(
    () => new Map(assignees.map((assignee) => [assignee.id, assignee.name])),
    [assignees]
  );

  if (isLoading) {
    return <SkeletonTable rows={8} columns={7} />;
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No matching leads"
        description="Adjust the search or filters to see more CRM leads."
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(leads.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * LIST_PAGE_SIZE;
  const visibleLeads = leads.slice(start, start + LIST_PAGE_SIZE);
  const pagination: PaginationMeta = {
    page: currentPage,
    pageSize: LIST_PAGE_SIZE,
    totalCount: leads.length,
    totalPages,
  };

  const openLead = (leadId: string) => {
    router.push(ROUTES.admin.crm.leadDetail(leadId));
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[1015px] table-fixed border-collapse">
          <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50">
            <tr>
              {listColumns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`${column.className} h-9 whitespace-nowrap px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-neutral-600`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visibleLeads.map((lead) => (
              <tr
                key={lead.id}
                tabIndex={0}
                aria-label={`Open ${lead.contactName}`}
                onClick={() => openLead(lead.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openLead(lead.id);
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                <td className="px-3 py-2.5">
                  <p
                    className="max-w-[220px] truncate text-sm font-medium text-neutral-900"
                    title={lead.contactName}
                  >
                    {lead.contactName}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {maskPhone(lead.contactPhone)}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={statusVariant(lead.leadStatus)} size="sm">
                    {CRM_STATUS_LABELS[lead.leadStatus]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-sm text-neutral-700">
                  {sourceLabel(lead.source)}
                </td>
                <td className="px-3 py-2.5 text-sm text-neutral-700">
                  {lead.assignedAdminUserId
                    ? (assigneeNames.get(lead.assignedAdminUserId) ??
                      "Assigned user")
                    : "Unassigned"}
                </td>
                <td className="px-3 py-2.5">
                  <p
                    className="max-w-[190px] truncate text-sm text-neutral-800"
                    title={lead.targetUnitName ?? undefined}
                  >
                    {lead.targetUnitName ?? "No unit selected"}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
                    {formatDateRange(
                      lead.desiredCheckInDate,
                      lead.desiredCheckOutDate
                    )}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-sm tabular-nums text-neutral-600">
                  {formatDate(lead.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`View ${lead.contactName}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openLead(lead.id);
                    }}
                  >
                    <Eye className="me-2 h-4 w-4" aria-hidden="true" />
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        meta={pagination}
        onPageChange={onPageChange}
        className="bg-neutral-50/70 shrink-0 rounded-none border-x-0 border-b-0 px-3 py-2"
      />
    </div>
  );
}
