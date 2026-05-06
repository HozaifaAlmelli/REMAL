"use client";

import { CrmLeadListItemResponse } from "@/lib/types/crm.types";
import { parseISO, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import { formatDateRange } from "@/lib/utils/format";

interface LeadCardProps {
  lead: CrmLeadListItemResponse;
  className?: string;
}

export function LeadCard({ lead, className }: LeadCardProps) {
  const router = useRouter();
  const daysInStatus = differenceInDays(new Date(), parseISO(lead.createdAt));
  const isNoAnswer = lead.leadStatus === "lost";

  const maskedPhone =
    lead.contactPhone.length > 7
      ? `${lead.contactPhone.slice(0, 4)}***${lead.contactPhone.slice(-4)}`
      : lead.contactPhone;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(ROUTES.admin.crm.leadDetail(lead.id))}
      onKeyDown={(e) =>
        e.key === "Enter" && router.push(ROUTES.admin.crm.leadDetail(lead.id))
      }
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("leadId", lead.id);
        e.dataTransfer.setData("leadStatus", lead.leadStatus);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "bg-white rounded-lg p-3.5 shadow-sm hover:shadow-card-hover cursor-pointer",
        "border border-neutral-100 transition-shadow duration-150 active:scale-95 active:rotate-1 opacity-100",
        isNoAnswer && "border-l-2 border-l-warning",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-medium text-neutral-800 text-sm leading-tight">
          {lead.contactName}
        </p>
        <span
          className={cn(
            "text-xs font-mono shrink-0",
            isNoAnswer ? "text-warning font-semibold" : "text-neutral-400"
          )}
        >
          {daysInStatus}d
        </span>
      </div>

      <p className="text-xs text-neutral-500 mb-1.5">{maskedPhone}</p>

      {lead.targetUnitId && (
        <p className="text-xs text-neutral-600 mb-1.5 truncate">
          Unit: {lead.targetUnitName || lead.targetUnitId.slice(0, 8)}
        </p>
      )}

      {lead.desiredCheckInDate && lead.desiredCheckOutDate && (
        <p className="text-xs text-neutral-500 mb-2">
          {formatDateRange(lead.desiredCheckInDate, lead.desiredCheckOutDate)}
        </p>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-50">
        <Badge variant="info" size="sm">
          {BOOKING_SOURCE_LABELS[
            lead.source as keyof typeof BOOKING_SOURCE_LABELS
          ] ?? lead.source}
        </Badge>
        {lead.assignedAdminUserId && (
          <span className="text-xs text-neutral-400 truncate max-w-28">
            Assigned
          </span>
        )}
      </div>
    </div>
  );
}
