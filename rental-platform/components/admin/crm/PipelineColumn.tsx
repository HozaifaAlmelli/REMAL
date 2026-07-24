"use client";

import { CrmLeadStatus, CrmLeadListItemResponse } from "@/lib/types/crm.types";
import { LeadCard } from "./LeadCard";
import { Badge } from "@/components/ui/Badge";
import { CRM_VALID_TRANSITIONS } from "@/lib/constants/booking-statuses";
import { toastError } from "@/lib/utils/toast";
import { useEffect, useRef } from "react";

interface PipelineColumnProps {
  status: CrmLeadStatus;
  label: string;
  leads: CrmLeadListItemResponse[];
  isLoading: boolean;
  onDropLead?: (leadId: string, targetStatus: CrmLeadStatus) => void;
}

function isValidDrop(sourceStatus: string, targetStatus: string): boolean {
  if (sourceStatus === targetStatus) return false;
  const allowed = CRM_VALID_TRANSITIONS[sourceStatus as CrmLeadStatus] ?? [];
  return allowed.includes(targetStatus as CrmLeadStatus);
}

export function PipelineColumn({
  status,
  label,
  leads,
  isLoading,
  onDropLead,
}: PipelineColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const storageKey = `crm-stage-scroll:${status}`;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const savedPosition = Number(sessionStorage.getItem(storageKey));
    if (Number.isFinite(savedPosition) && savedPosition > 0) {
      list.scrollTop = savedPosition;
    }
  }, [storageKey]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add(
          "ring-2",
          "ring-primary/40",
          "bg-neutral-200/80"
        );

        const list = listRef.current;
        if (list) {
          const bounds = list.getBoundingClientRect();
          const edge = 48;
          if (e.clientY < bounds.top + edge) list.scrollBy(0, -18);
          if (e.clientY > bounds.bottom - edge) list.scrollBy(0, 18);
        }
      }}
      onDragLeave={(e) => {
        if (
          e.relatedTarget instanceof Node &&
          e.currentTarget.contains(e.relatedTarget)
        ) {
          return;
        }
        e.currentTarget.classList.remove(
          "ring-2",
          "ring-primary/40",
          "bg-neutral-200/80"
        );
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove(
          "ring-2",
          "ring-primary/40",
          "bg-neutral-200/80"
        );
        const leadId = e.dataTransfer.getData("leadId");
        const sourceStatus = e.dataTransfer.getData("leadStatus");

        if (!leadId || !onDropLead) return;

        if (sourceStatus === status) return;

        if (sourceStatus && !isValidDrop(sourceStatus, status)) {
          toastError(
            `Cannot move lead from "${sourceStatus}" to "${status}". Only forward transitions are allowed.`
          );
          return;
        }

        onDropLead(leadId, status);
      }}
      data-stage={status}
      className="flex h-full min-h-0 w-[330px] min-w-[330px] max-w-[330px] shrink-0 flex-col rounded-md border border-neutral-200 bg-neutral-50 p-3 transition-colors duration-200"
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">{label}</h3>
        <Badge
          variant={leads.length > 0 ? "info" : "neutral"}
          className="rounded-full px-2 py-0.5 text-xs"
        >
          {leads.length}
        </Badge>
      </div>

      <div
        ref={listRef}
        role="list"
        tabIndex={0}
        aria-label={`${label} leads`}
        data-testid={`crm-stage-list-${status}`}
        onScroll={(event) =>
          sessionStorage.setItem(
            storageKey,
            String(event.currentTarget.scrollTop)
          )
        }
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-2 pe-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {isLoading ? (
          <span className="py-4 text-center text-sm italic text-neutral-500">
            Loading leads...
          </span>
        ) : leads.length === 0 ? (
          <div className="flex min-h-28 flex-1 items-center justify-center rounded-md border border-dashed border-neutral-300 p-6">
            <span className="text-sm italic text-neutral-400">
              This stage is empty
            </span>
          </div>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} role="listitem">
              <LeadCard lead={lead} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
