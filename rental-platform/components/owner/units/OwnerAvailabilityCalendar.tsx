"use client";
import { useEffect, useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { differenceInCalendarDays, format, startOfToday } from "date-fns";
import {
  useCreateOwnerDateBlock,
  useDeleteOwnerDateBlock,
  useOwnerDateBlockPreflight,
  useOwnerUnitDateBlocks,
  useOwnerUnitAvailability,
} from "@/lib/hooks/useOwnerPortal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { AlertCircle, CheckCircle2, Clock3, Plus, X } from "lucide-react";
import { toast } from "react-hot-toast";
import "react-day-picker/style.css";
import type {
  DateBlockPreflightOutcome,
  DateBlockReason,
  DateBlockResponse,
} from "@/lib/types/unit.types";

interface OwnerAvailabilityCalendarProps {
  unitId: string;
  unitName: string;
}

const PREFLIGHT_DEBOUNCE_MS = 300;

const REASONS: Array<{ value: DateBlockReason; label: string }> = [
  { value: "OwnerUse", label: "Owner use" },
  { value: "Maintenance", label: "Maintenance" },
  { value: "Other", label: "Other" },
];

const REASON_LABELS: Record<DateBlockReason, string> = {
  OwnerUse: "Owner use",
  Maintenance: "Maintenance",
  Other: "Other",
};

function parseDateOnly(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildDateRange(startDate: string, endDate: string): Date[] {
  const dates: Date[] = [];
  const current = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getOwnerBlockDates(
  blocks: DateBlockResponse[],
  status: DateBlockResponse["status"]
): Date[] {
  return blocks
    .filter((block) => block.status === status)
    .flatMap((block) => buildDateRange(block.startDate, block.endDate));
}

function formatBlockRange(startDate: string, endDate: string): string {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (startDate === endDate) return format(start, "MMM d, yyyy");
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

function getPreflightNotice(outcome?: DateBlockPreflightOutcome) {
  switch (outcome) {
    case "clear":
      return {
        icon: CheckCircle2,
        className: "border-success-bg bg-success-bg text-success",
        text: "These nights are clear — they'll close right away.",
      };
    case "requires_approval":
      return {
        icon: Clock3,
        className: "border-warning-bg bg-warning-bg text-warning",
        text: "Overlaps an active inquiry — we'll send this for a quick admin review.",
      };
    case "hard_blocked":
      return {
        icon: AlertCircle,
        className: "border-error-bg bg-error-bg text-error",
        text: "These nights hold a confirmed booking or block and can't be closed.",
      };
    default:
      return null;
  }
}

export function OwnerAvailabilityCalendar({
  unitId,
  unitName,
}: OwnerAvailabilityCalendarProps) {
  const today = startOfToday();
  const [currentMonth, setCurrentMonth] = useState(today);
  const [range, setRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState<DateBlockReason>("OwnerUse");
  const [notes, setNotes] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  const { data, isLoading } = useOwnerUnitAvailability(unitId, currentMonth);
  const { data: ownerBlocks = [] } = useOwnerUnitDateBlocks(unitId);
  const createBlock = useCreateOwnerDateBlock(unitId);
  const deleteBlock = useDeleteOwnerDateBlock(unitId);

  // Firm occupied nights the availability endpoint reports (bookings + owner
  // blocks + pending blocks). These can't be picked as a new block.
  const occupiedDays = useMemo(
    () => (data?.blockedDates ?? []).map(parseDateOnly),
    [data?.blockedDates]
  );
  // Soft storefront requests are shown but remain selectable. The preflight
  // endpoint will return requires_approval so owners can request an override.
  const requestedDays = useMemo(
    () => (data?.heldDates ?? []).map(parseDateOnly),
    [data?.heldDates]
  );
  const approvedOwnerDays = useMemo(
    () => getOwnerBlockDates(ownerBlocks, "approved"),
    [ownerBlocks]
  );
  const pendingOwnerDays = useMemo(
    () => getOwnerBlockDates(ownerBlocks, "pending_approval"),
    [ownerBlocks]
  );

  // Split occupied nights into their three meanings so each reads in its own
  // colour. Owner closures carry their own styling, so what's left is bookings.
  const ownerDayKeys = useMemo(() => {
    const keys = new Set<number>();
    for (const day of [...approvedOwnerDays, ...pendingOwnerDays]) {
      keys.add(day.getTime());
    }
    return keys;
  }, [approvedOwnerDays, pendingOwnerDays]);

  const bookedDays = useMemo(
    () => occupiedDays.filter((day) => !ownerDayKeys.has(day.getTime())),
    [occupiedDays, ownerDayKeys]
  );

  const startStr = range?.from ? format(range.from, "yyyy-MM-dd") : null;
  const endStr = range?.to ? format(range.to, "yyyy-MM-dd") : null;
  const hasValidRange = Boolean(startStr && endStr);
  const nights =
    range?.from && range?.to
      ? differenceInCalendarDays(range.to, range.from) + 1
      : 0;

  const [debouncedRange, setDebouncedRange] = useState<{
    startDate: string | null;
    endDate: string | null;
  }>({ startDate: null, endDate: null });

  useEffect(() => {
    if (!hasValidRange) {
      setDebouncedRange({ startDate: null, endDate: null });
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDebouncedRange({ startDate: startStr, endDate: endStr });
    }, PREFLIGHT_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [startStr, endStr, hasValidRange]);

  const {
    data: preflight,
    isFetching: isPreflightFetching,
    isError: isPreflightError,
  } = useOwnerDateBlockPreflight(
    unitId,
    debouncedRange.startDate,
    debouncedRange.endDate,
    hasValidRange
  );

  const isPreflightStale =
    hasValidRange &&
    (debouncedRange.startDate !== startStr ||
      debouncedRange.endDate !== endStr);
  const preflightNotice = getPreflightNotice(preflight?.outcome);
  const isHardBlocked = preflight?.outcome === "hard_blocked";
  const requiresApproval = preflight?.outcome === "requires_approval";

  const canCreateBlock =
    hasValidRange &&
    !createBlock.isPending &&
    !isPreflightFetching &&
    !isPreflightStale &&
    !isPreflightError &&
    !isHardBlocked;

  const resetForm = () => {
    setRange(undefined);
    setNotes("");
    setNoteOpen(false);
    setDebouncedRange({ startDate: null, endDate: null });
  };

  const submitBlock = () => {
    if (!canCreateBlock || !startStr || !endStr) return;
    createBlock.mutate(
      {
        startDate: startStr,
        endDate: endStr,
        reason,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (createdBlock) => {
          toast.success(
            createdBlock.status === "pending_approval"
              ? "Sent for review — we'll hold these nights meanwhile"
              : "Nights closed"
          );
          resetForm();
        },
        onError: (error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : "Could not close these nights"
          );
        },
      }
    );
  };

  const reopenableBlocks = ownerBlocks.filter(
    (block) =>
      block.status === "approved" || block.status === "pending_approval"
  );

  const handleReopen = (block: DateBlockResponse) => {
    deleteBlock.mutate(block.id, {
      onSuccess: () => toast.success("Nights re-opened"),
      onError: (error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Could not re-open these nights"
        );
      },
    });
  };

  const disabledMatchers = useMemo(
    () => [{ before: today }, ...occupiedDays],
    [today, occupiedDays]
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Heading + reassurance */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-neutral-900">
          {unitName}
        </h2>
        <p className="text-sm text-neutral-500">
          Tap a start and end night to close them. We&rsquo;ll check instantly —
          clear nights close on the spot.
        </p>
      </div>

      {/* Calendar */}
      <div className="rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white p-3 sm:p-5">
        {isLoading ? (
          <Skeleton className="mx-auto h-[330px] w-full max-w-sm" />
        ) : (
          <div className="cal-skin">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              disabled={disabledMatchers}
              excludeDisabled
              showOutsideDays
              modifiers={{
                booked: bookedDays,
                ownerApproved: approvedOwnerDays,
                ownerPending: pendingOwnerDays,
                requested: requestedDays,
              }}
              modifiersClassNames={{
                booked: "cal-booked",
                ownerApproved: "cal-owner",
                ownerPending: "cal-pending",
                requested: "cal-requested",
              }}
            />
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-4">
          <LegendDot className="border border-neutral-300 bg-white" label="Available" />
          <LegendDot className="bg-error-bg" label="Booked" />
          <LegendDot className="border border-warning/40 bg-warning-bg" label="Requested" />
          <LegendDot className="bg-neutral-200" label="Your block" />
          <LegendDot
            className="bg-warning-bg"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent 0 3px, rgba(180,83,9,0.18) 3px 6px)",
            }}
            label="Pending review"
          />
          <LegendDot className="bg-primary-500" label="Selected" />
        </div>
      </div>

      {/* Contextual action panel */}
      <div className="rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white">
        {!range?.from ? (
          <p className="px-5 py-6 text-center text-sm text-neutral-500">
            Pick a start night on the calendar to begin.
          </p>
        ) : !hasValidRange ? (
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900 tabular-nums">
                {format(range.from, "MMM d")}
              </span>{" "}
              — now tap the end night{" "}
              <span className="text-neutral-400">(or the same night for one).</span>
            </p>
            <button
              type="button"
              onClick={resetForm}
              className="text-neutral-400 transition-colors hover:text-neutral-700"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {/* Selection summary */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-neutral-900 tabular-nums">
                  {formatBlockRange(startStr!, endStr!)}
                </p>
                <p className="text-xs text-neutral-500 tabular-nums">
                  {nights} night{nights === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-700"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>

            {/* Reason — segmented control */}
            <div>
              <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                Reason
              </span>
              <div
                role="radiogroup"
                aria-label="Reason"
                className="inline-flex rounded-[var(--portal-radius-control)] border border-neutral-200 bg-neutral-50 p-0.5"
              >
                {REASONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={reason === opt.value}
                    onClick={() => setReason(opt.value)}
                    className={cn(
                      "rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
                      reason === opt.value
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-800"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note — progressive disclosure */}
            {noteOpen ? (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                  Note <span className="text-neutral-400">(optional)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="e.g. family staying over"
                  className="w-full resize-none rounded-[var(--portal-radius-control)] border border-neutral-200 px-3 py-2 text-sm text-neutral-800 transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add a note
              </button>
            )}

            {/* Preflight notice */}
            {(isPreflightFetching || isPreflightStale) && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Clock3 className="h-4 w-4" />
                Checking these nights…
              </div>
            )}
            {!isPreflightFetching && !isPreflightStale && isPreflightError && (
              <div className="flex items-center gap-2 rounded-[var(--portal-radius-control)] border border-error-bg bg-error-bg px-3 py-2 text-sm text-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Couldn&rsquo;t verify these nights. Try again.
              </div>
            )}
            {!isPreflightFetching &&
              !isPreflightStale &&
              !isPreflightError &&
              preflightNotice && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-[var(--portal-radius-control)] border px-3 py-2 text-sm",
                    preflightNotice.className
                  )}
                >
                  <preflightNotice.icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{preflightNotice.text}</span>
                </div>
              )}

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                onClick={submitBlock}
                isLoading={createBlock.isPending}
                disabled={!canCreateBlock}
              >
                {requiresApproval ? "Request review" : "Close these nights"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Your closed dates — re-open any of them */}
      {reopenableBlocks.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-neutral-900">
            Your closed dates
          </h3>
          <ul className="overflow-hidden rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white">
            {reopenableBlocks.map((block, index) => {
              const isPending = block.status === "pending_approval";
              const isRemoving =
                deleteBlock.isPending && deleteBlock.variables === block.id;
              return (
                <li
                  key={block.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3",
                    index > 0 && "border-t border-neutral-100"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-800 tabular-nums">
                      {formatBlockRange(block.startDate, block.endDate)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span>{REASON_LABELS[block.reason] ?? block.reason}</span>
                      {isPending && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 font-medium text-warning ring-1 ring-inset ring-warning/30">
                          <Clock3 className="h-3 w-3" />
                          Pending review
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isRemoving}
                    disabled={deleteBlock.isPending}
                    onClick={() => handleReopen(block)}
                  >
                    {isPending ? "Withdraw" : "Reopen"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function LegendDot({
  className,
  style,
  label,
}: {
  className?: string;
  style?: React.CSSProperties;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("h-3.5 w-3.5 rounded-[5px]", className)} style={style} />
      <span className="text-xs text-neutral-600">{label}</span>
    </span>
  );
}
