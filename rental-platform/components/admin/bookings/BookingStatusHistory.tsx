"use client";

import { useBookingStatusHistory } from "@/lib/hooks/useBookings";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatRelativeTime } from "@/lib/utils/format";
import { Bot, CircleHelp, User } from "lucide-react";
import type { BookingStatusHistoryResponse } from "@/lib/types/booking.types";

interface BookingStatusHistoryProps {
  bookingId: string;
}

export function BookingStatusHistory({ bookingId }: BookingStatusHistoryProps) {
  const { data: history, isLoading } = useBookingStatusHistory(bookingId);

  const isSystemEntry = (entry: BookingStatusHistoryResponse) => {
    return entry.actorType === "system" || entry.actorType === "online";
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="py-4 text-sm italic text-neutral-400">
        No status history available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-700">Status History</h3>

      <div className="relative space-y-0">
        {history.map((entry, index) => {
          const isSystem = isSystemEntry(entry);

          return (
            <div key={entry.id} className="relative flex gap-3 pb-4">
              {/* Timeline line */}
              {index < history.length - 1 && (
                <div className="absolute bottom-0 left-[15px] top-8 w-px bg-neutral-200" />
              )}

              {/* Timeline dot */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isSystem
                    ? "bg-blue-50 text-blue-500"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {isSystem ? (
                  <Bot className="h-4 w-4" />
                ) : entry.actorType === "unavailable" ? (
                  <CircleHelp className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status transition */}
                  {entry.oldStatus && (
                    <>
                      <StatusBadge status={entry.oldStatus} />
                      <span className="text-xs text-neutral-400">→</span>
                    </>
                  )}
                  <StatusBadge status={entry.newStatus} />
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`min-w-0 break-words text-xs font-medium ${
                      isSystem ? "text-blue-600" : "text-neutral-600"
                    }`}
                  >
                    {entry.actorDisplayName}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {formatRelativeTime(entry.changedAt)}
                  </span>
                </div>

                {entry.notes && (
                  <p className="mt-1 whitespace-pre-wrap break-words rounded bg-neutral-50 p-1.5 text-xs text-neutral-500">
                    {entry.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
