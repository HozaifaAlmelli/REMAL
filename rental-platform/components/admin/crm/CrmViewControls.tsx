"use client";

import { Columns3, List, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  CRM_LEAD_STATUSES,
  CRM_STATUS_LABELS,
  type CrmLeadStatus,
} from "@/lib/constants/booking-statuses";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import {
  CRM_VIEWS,
  type CrmLeadFilterState,
  type CrmView,
} from "@/lib/crm/lead-filters";
import type { CrmAssigneeResponse } from "@/lib/types/crm.types";
import { cn } from "@/lib/utils/cn";

interface CrmViewControlsProps {
  view: CrmView;
  filters: CrmLeadFilterState;
  sources: string[];
  assignees: CrmAssigneeResponse[];
  filteredCount: number;
  totalCount: number;
  onViewChange: (view: CrmView) => void;
  onFilterChange: <K extends keyof CrmLeadFilterState>(
    key: K,
    value: CrmLeadFilterState[K]
  ) => void;
  onReset: () => void;
}

const viewOptions = [
  { value: CRM_VIEWS.Pipeline, label: "Pipeline", icon: Columns3 },
  { value: CRM_VIEWS.List, label: "List", icon: List },
] as const;

function sourceLabel(source: string): string {
  return (
    BOOKING_SOURCE_LABELS[source as keyof typeof BOOKING_SOURCE_LABELS] ??
    source
  );
}

export function CrmViewControls({
  view,
  filters,
  sources,
  assignees,
  filteredCount,
  totalCount,
  onViewChange,
  onFilterChange,
  onReset,
}: CrmViewControlsProps) {
  const hasFilters = Boolean(
    filters.search || filters.status || filters.source || filters.ownerId
  );

  return (
    <section
      aria-label="Lead view and filters"
      className="shrink-0 border-y border-neutral-200 bg-white py-3"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div
          className="inline-flex w-fit rounded-[var(--portal-radius-control)] border border-neutral-200 bg-neutral-50 p-0.5"
          role="group"
          aria-label="CRM view"
        >
          {viewOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => onViewChange(value)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-[4px] px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
                view === value
                  ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200"
                  : "text-neutral-500 hover:text-neutral-800"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:max-w-[900px] xl:grid-cols-[minmax(220px,1fr)_160px_150px_190px_auto]">
          <Input
            aria-label="Search leads"
            placeholder="Search name, phone, email, or unit"
            value={filters.search}
            onChange={(event) => onFilterChange("search", event.target.value)}
            leftAddon={<Search className="h-4 w-4" aria-hidden="true" />}
          />
          <Select
            aria-label="Filter by stage"
            value={filters.status}
            onChange={(value) =>
              onFilterChange("status", value as CrmLeadStatus | "")
            }
            options={[
              { value: "", label: "All stages" },
              ...Object.values(CRM_LEAD_STATUSES).map((status) => ({
                value: status,
                label: CRM_STATUS_LABELS[status],
              })),
            ]}
          />
          <Select
            aria-label="Filter by source"
            value={filters.source}
            onChange={(value) => onFilterChange("source", String(value))}
            options={[
              { value: "", label: "All sources" },
              ...sources.map((source) => ({
                value: source,
                label: sourceLabel(source),
              })),
            ]}
          />
          <Select
            aria-label="Filter by assigned owner"
            value={filters.ownerId}
            onChange={(value) => onFilterChange("ownerId", String(value))}
            options={[
              { value: "", label: "All owners" },
              { value: "unassigned", label: "Unassigned" },
              ...assignees.map((assignee) => ({
                value: assignee.id,
                label: assignee.name,
              })),
            ]}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={!hasFilters}
            aria-label="Clear CRM filters"
            className="h-[var(--portal-control-height)] justify-center"
          >
            <RotateCcw className="me-2 h-4 w-4" aria-hidden="true" />
            Clear
          </Button>
        </div>
      </div>

      <p
        className="mt-2 text-xs tabular-nums text-neutral-500"
        aria-live="polite"
      >
        Showing {filteredCount} of {totalCount} leads
      </p>
    </section>
  );
}
