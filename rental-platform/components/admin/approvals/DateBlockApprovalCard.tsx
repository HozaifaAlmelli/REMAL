"use client";

import { CalendarDays, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DATE_BLOCK_REASON_LABELS } from "@/lib/constants/date-block-reasons";
import type { DateBlockApprovalItem } from "@/lib/types/unit.types";

interface DateBlockApprovalCardProps {
  item: DateBlockApprovalItem;
  isResolving: boolean;
  onApprove: (item: DateBlockApprovalItem) => void;
  onReject: (item: DateBlockApprovalItem) => void;
}

function shortId(id: string | null) {
  return id ? id.slice(0, 8).toUpperCase() : null;
}

function formatRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return "Dates not captured";
  return `${startDate} -> ${endDate}`;
}

function formatReason(item: DateBlockApprovalItem) {
  if (!item.reason) return "Owner request";
  return DATE_BLOCK_REASON_LABELS[item.reason] ?? item.reason;
}

export function DateBlockApprovalCard({
  item,
  isResolving,
  onApprove,
  onReject,
}: DateBlockApprovalCardProps) {
  const leadRef = shortId(item.conflictingLeadId);
  const bookingRef = shortId(item.conflictingBookingId);

  return (
    <article className="rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-neutral-900">
              {item.unitName}
            </h2>
            <Badge variant="warning" size="sm">
              Pending approval
            </Badge>
          </div>

          <div className="grid gap-2 text-sm text-neutral-600 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">Owner</p>
              <p className="truncate text-neutral-800">{item.ownerName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">Requested dates</p>
              <p className="font-[var(--font-body)] tabular-nums text-neutral-800">
                {formatRange(item.startDate, item.endDate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">Reason</p>
              <p className="text-neutral-800">{formatReason(item)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">Conflicts</p>
              <p className="tabular-nums text-neutral-800">
                {item.conflictCount}
              </p>
            </div>
          </div>

          <div className="rounded-[var(--portal-radius-control)] border border-neutral-200 bg-neutral-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-700">
              <CalendarDays className="h-3.5 w-3.5" />
              Conflict references
            </div>
            <div className="grid gap-2 text-xs text-neutral-600 md:grid-cols-2">
              <p className="tabular-nums">
                Lead:{" "}
                {leadRef
                  ? `${leadRef} (${formatRange(
                      item.conflictingLeadStartDate,
                      item.conflictingLeadEndDate
                    )})`
                  : "None stored"}
              </p>
              <p className="tabular-nums">
                Booking:{" "}
                {bookingRef
                  ? `${bookingRef} (${formatRange(
                      item.conflictingBookingCheckInDate,
                      item.conflictingBookingCheckOutDate
                    )})`
                  : "None stored"}
              </p>
            </div>
          </div>

          {item.notes && (
            <p className="max-w-[80ch] text-sm text-neutral-600">
              {item.notes}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 md:flex-col">
          <Button
            size="sm"
            onClick={() => onApprove(item)}
            isLoading={isResolving}
            leftIcon={<Check className="h-4 w-4" />}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(item)}
            disabled={isResolving}
            leftIcon={<X className="h-4 w-4" />}
          >
            Reject
          </Button>
        </div>
      </div>
    </article>
  );
}
