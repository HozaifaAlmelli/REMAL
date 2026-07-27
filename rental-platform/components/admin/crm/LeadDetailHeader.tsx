import { CrmLeadDetailsResponse } from "@/lib/types/crm.types";
import { Badge } from "@/components/ui/Badge";
import { parseISO, differenceInDays } from "date-fns";
import { CRM_STATUS_LABELS } from "@/lib/constants/booking-statuses";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import { getStatusVariant } from "@/lib/utils/status";
import { Mail, Phone } from "lucide-react";
import { NEEDS_RECOMMENDATION_BADGE } from "@/lib/constants/crm-recommendation";

interface LeadDetailHeaderProps {
  lead: CrmLeadDetailsResponse;
}

export function LeadDetailHeader({ lead }: LeadDetailHeaderProps) {
  const daysInStatus = differenceInDays(new Date(), parseISO(lead.createdAt));

  const sourceLabel =
    BOOKING_SOURCE_LABELS[lead.source as keyof typeof BOOKING_SOURCE_LABELS] ??
    lead.source;

  const statusLabel =
    CRM_STATUS_LABELS[lead.leadStatus as keyof typeof CRM_STATUS_LABELS] ??
    lead.leadStatus;

  return (
    <div className="flex flex-col justify-between gap-4 rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white p-5 md:flex-row md:items-center">
      <div className="space-y-1">
        <h1 className="text-[21px] font-semibold leading-tight text-neutral-900">
          {lead.contactName}
        </h1>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Phone className="h-4 w-4" />
            {lead.contactPhone}
          </span>
          {lead.contactEmail && (
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              {lead.contactEmail}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 md:items-end">
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Badge variant="info">{sourceLabel}</Badge>
          {lead.needsRecommendation && (
            <Badge variant="warning" size="sm">
              {NEEDS_RECOMMENDATION_BADGE}
            </Badge>
          )}
          <Badge variant={getStatusVariant(lead.leadStatus)}>
            {statusLabel}
          </Badge>
        </div>
        <span className="text-sm font-medium text-neutral-400">
          {daysInStatus} {daysInStatus === 1 ? "day" : "days"} in status
        </span>
      </div>
    </div>
  );
}
