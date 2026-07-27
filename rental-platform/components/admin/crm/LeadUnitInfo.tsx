import { CrmLeadDetailsResponse } from "@/lib/types/crm.types";
import { formatDateRange } from "@/lib/utils/format";
import { Home, Calendar, Users } from "lucide-react";
import {
  WAITING_FOR_RECOMMENDATION,
  WAITING_FOR_RECOMMENDATION_HINT,
} from "@/lib/constants/crm-recommendation";

interface LeadUnitInfoProps {
  lead: CrmLeadDetailsResponse;
}

export function LeadUnitInfo({ lead }: LeadUnitInfoProps) {
  const hasDates = lead.desiredCheckInDate && lead.desiredCheckOutDate;

  return (
    <div className="mt-4 rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-900">
        Unit inquiry
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Unit</span>
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-neutral-400" />
            {lead.targetUnitId ? (
              <span className="font-mono text-sm font-medium text-neutral-800">
                Unit: {lead.targetUnitName || lead.targetUnitId}
              </span>
            ) : lead.needsRecommendation ? (
              <span className="text-sm font-medium text-neutral-700">
                {WAITING_FOR_RECOMMENDATION}
              </span>
            ) : (
              <span className="text-sm italic text-neutral-400">
                Unit not selected
              </span>
            )}
          </div>
          {lead.needsRecommendation && (
            <p className="mt-1 text-xs text-neutral-500">
              {WAITING_FOR_RECOMMENDATION_HINT}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Dates</span>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-400" />
            {hasDates ? (
              <span className="text-sm font-medium text-neutral-800">
                {formatDateRange(
                  lead.desiredCheckInDate!,
                  lead.desiredCheckOutDate!
                )}
              </span>
            ) : (
              <span className="text-sm italic text-neutral-400">
                No dates specified
              </span>
            )}
          </div>
        </div>

        {lead.guestCount !== null && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">Guests</span>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-400" />
              <span className="text-sm font-medium text-neutral-800">
                {lead.guestCount} {lead.guestCount === 1 ? "guest" : "guests"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
