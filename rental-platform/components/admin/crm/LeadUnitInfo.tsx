import { CrmLeadDetailsResponse } from "@/lib/types/crm.types";
import { formatDateRange } from "@/lib/utils/format";
import { Home, Calendar, Users } from "lucide-react";

interface LeadUnitInfoProps {
  lead: CrmLeadDetailsResponse;
}

export function LeadUnitInfo({ lead }: LeadUnitInfoProps) {
  const hasDates = lead.desiredCheckInDate && lead.desiredCheckOutDate;

  return (
    <div className="mt-4 rounded-lg border border-neutral-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 border-b border-neutral-100 pb-2 text-sm font-semibold uppercase tracking-wider text-neutral-800">
        Unit Inquiry
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase text-neutral-400">
            Unit
          </span>
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-neutral-400" />
            {lead.targetUnitId ? (
              <span className="font-mono text-sm font-medium text-neutral-800">
                Unit: {lead.targetUnitName || lead.targetUnitId}
              </span>
            ) : (
              <span className="text-sm italic text-neutral-400">
                No unit selected yet
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase text-neutral-400">
            Dates
          </span>
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
            <span className="text-xs font-medium uppercase text-neutral-400">
              Guests
            </span>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-400" />
              <span className="text-sm font-medium text-neutral-800">
                {lead.guestCount} {lead.guestCount === 1 ? "Guest" : "Guests"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
