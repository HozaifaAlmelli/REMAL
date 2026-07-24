"use client";

import { CrmLeadListItemResponse } from "@/lib/types/crm.types";
import { parseISO, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import { formatDateRange } from "@/lib/utils/format";
import { useRef } from "react";

interface LeadCardProps {
  lead: CrmLeadListItemResponse;
  className?: string;
}

export function LeadCard({ lead, className }: LeadCardProps) {
  const router = useRouter();
  const suppressClickAfterDrag = useRef(false);
  const daysInStatus = differenceInDays(new Date(), parseISO(lead.createdAt));
  const isNoAnswer = lead.leadStatus === "NoAnswer";

  const maskedPhone =
    lead.contactPhone.length > 7
      ? `${lead.contactPhone.slice(0, 4)}***${lead.contactPhone.slice(-4)}`
      : lead.contactPhone;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${lead.contactName}`}
      onClick={() => {
        if (suppressClickAfterDrag.current) return;
        router.push(ROUTES.admin.crm.leadDetail(lead.id));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(ROUTES.admin.crm.leadDetail(lead.id));
        }
      }}
      draggable
      onDragStart={(e) => {
        suppressClickAfterDrag.current = true;
        e.dataTransfer.setData("leadId", lead.id);
        e.dataTransfer.setData("leadStatus", lead.leadStatus);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          suppressClickAfterDrag.current = false;
        }, 0);
      }}
      className={cn(
        "cursor-pointer touch-pan-y rounded-[var(--portal-radius-control)] bg-white p-3",
        "border border-neutral-200 transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        isNoAnswer && "border-warning/50",
        className
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight text-neutral-800">
          {lead.contactName}
        </p>
        <span
          className={cn(
            "shrink-0 font-mono text-xs",
            isNoAnswer ? "font-semibold text-warning" : "text-neutral-400"
          )}
        >
          {daysInStatus}d
        </span>
      </div>

      <p className="mb-1.5 text-xs text-neutral-500">{maskedPhone}</p>

      {lead.targetUnitId && (
        <p className="mb-1.5 truncate text-xs text-neutral-600">
          Unit: {lead.targetUnitName || lead.targetUnitId.slice(0, 8)}
        </p>
      )}

      {lead.desiredCheckInDate && lead.desiredCheckOutDate && (
        <p className="mb-2 text-xs text-neutral-500">
          {formatDateRange(lead.desiredCheckInDate, lead.desiredCheckOutDate)}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2">
        <Badge variant="info" size="sm">
          {BOOKING_SOURCE_LABELS[
            lead.source as keyof typeof BOOKING_SOURCE_LABELS
          ] ?? lead.source}
        </Badge>
        {lead.assignedAdminUserId && (
          <span className="max-w-28 truncate text-xs text-neutral-400">
            Assigned
          </span>
        )}
      </div>
    </div>
  );
}
