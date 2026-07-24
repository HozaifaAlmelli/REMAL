"use client";

import { PipelineColumn } from "./PipelineColumn";
import { PipelineColumnSkeleton } from "./PipelineColumnSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Users, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CRM_PIPELINE_COLUMNS,
  CRM_CLOSED_STATUSES,
  CRM_STATUS_LABELS,
} from "@/lib/constants/booking-statuses";
import { queryKeys } from "@/lib/utils/query-keys";
import { toastError, toastSuccess } from "@/lib/utils/toast";
import type {
  CrmLeadListItemResponse,
  CrmLeadStatus,
} from "@/lib/types/crm.types";

interface PipelineBoardProps {
  leads: CrmLeadListItemResponse[];
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
}

export default function PipelineBoard({
  leads,
  totalCount,
  isLoading,
  isError,
  onRefetch,
}: PipelineBoardProps) {
  const [isClosedSectionOpen, setIsClosedSectionOpen] = useState(false);
  const queryClient = useQueryClient();
  const boardRef = useRef<HTMLDivElement>(null);
  const groupedLeads = useMemo(
    () =>
      leads.reduce(
        (groups, lead) => {
          (groups[lead.leadStatus] ??= []).push(lead);
          return groups;
        },
        {} as Record<CrmLeadStatus, CrmLeadListItemResponse[]>
      ),
    [leads]
  );

  // Single drop handler so a board move keeps the board, the dashboard open-count,
  // AND the moved lead's detail view in sync — opening the card after a drag now
  // shows the new status without a manual refresh.
  const handleDropLead = async (leadId: string, target: CrmLeadStatus) => {
    try {
      const { crmService } = await import("@/lib/api/services/crm.service");
      await crmService.updateLeadStatus(leadId, { leadStatus: target });
      toastSuccess(`Lead moved to ${CRM_STATUS_LABELS[target] || target}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.openCount() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.crm.leadDetail(leadId),
        }),
      ]);
    } catch {
      toastError("Cannot move lead to this stage");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-start gap-4 overflow-x-auto pb-4">
        <PipelineColumnSkeleton />
        <PipelineColumnSkeleton />
        <PipelineColumnSkeleton />
        <PipelineColumnSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8 text-red-500" />}
        title="Could not load leads"
        description="We could not reach the leads pipeline. Retry to refresh the board."
        action={
          <Button onClick={onRefetch} variant="outline">
            Retry
          </Button>
        }
      />
    );
  }

  if (totalCount === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8 text-neutral-400" />}
        title="Pipeline is empty"
        description="New client enquiries will appear here when they submit a booking request."
      />
    );
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8 text-neutral-400" />}
        title="No matching leads"
        description="Adjust the search or filters to restore pipeline cards."
      />
    );
  }

  const closedLeadsCount = CRM_CLOSED_STATUSES.reduce(
    (acc, status) => acc + (groupedLeads[status]?.length || 0),
    0
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden">
      {/* Active Pipeline Board */}
      <div
        ref={boardRef}
        data-testid="crm-pipeline-board"
        onDragOver={(event) => {
          const board = boardRef.current;
          if (!board) return;
          const bounds = board.getBoundingClientRect();
          const edge = 56;
          if (event.clientX < bounds.left + edge) board.scrollBy(-24, 0);
          if (event.clientX > bounds.right - edge) board.scrollBy(24, 0);
        }}
        className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-hidden pb-3"
      >
        {CRM_PIPELINE_COLUMNS.map((status) => (
          <PipelineColumn
            key={status}
            status={status}
            label={CRM_STATUS_LABELS[status] || status}
            leads={groupedLeads[status] || []}
            isLoading={false}
            onDropLead={handleDropLead}
          />
        ))}
      </div>

      {/* Closed Section Accordion */}
      {totalCount > 0 && (
        <div className="flex shrink-0 flex-col gap-3 border-t border-neutral-200 pt-3">
          <button
            onClick={() => setIsClosedSectionOpen((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            {isClosedSectionOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {isClosedSectionOpen ? "Hide closed leads" : "Show closed leads"} (
            {closedLeadsCount})
          </button>

          {isClosedSectionOpen && (
            <div className="flex max-h-[38dvh] min-h-0 items-stretch gap-4 overflow-x-auto overflow-y-hidden pb-3">
              {CRM_CLOSED_STATUSES.map((status) => (
                <PipelineColumn
                  key={status}
                  status={status}
                  label={CRM_STATUS_LABELS[status] || status}
                  leads={groupedLeads[status] || []}
                  isLoading={false}
                  onDropLead={handleDropLead}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
