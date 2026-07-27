"use client";

import { useId, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { UNIT_TYPE_LABELS } from "@/lib/constants/unit-types";
import type { UnitListItemResponse, UnitType } from "@/lib/types/unit.types";

const TYPE_CHIPS: Array<{ value: "" | UnitType; label: string }> = [
  { value: "", label: "All" },
  ...(Object.entries(UNIT_TYPE_LABELS) as Array<[UnitType, string]>).map(
    ([value, label]) => ({ value, label })
  ),
];

interface AvailableUnitPickerProps {
  /** Units already filtered by date range (and unit type) from the live catalog query. */
  units: UnitListItemResponse[];
  value: string | null;
  onChange: (id: string | null) => void;
  unitTypeFilter: "" | UnitType;
  onUnitTypeFilterChange: (type: "" | UnitType) => void;
  hasValidRange: boolean;
  isRefreshing: boolean;
  isError?: boolean;
  onRetry?: () => void;
  labels?: Partial<AvailableUnitPickerLabels>;
  disabled?: boolean;
}

export interface AvailableUnitPickerLabels {
  allTypes: string;
  availableCount: (count: number) => string;
  refreshing: string;
  search: string;
  loading: string;
  noUnits: string;
  noSearchResults: (query: string) => string;
  loadError: string;
  retry: string;
  selected: string;
}

const DEFAULT_LABELS: AvailableUnitPickerLabels = {
  allTypes: "All",
  availableCount: (count) =>
    `${count} ${count === 1 ? "unit" : "units"} available`,
  refreshing: "Refreshing…",
  search: "Search units by name or project",
  loading: "Loading available units…",
  noUnits: "No available units were found for the selected stay.",
  noSearchResults: (query) => `No units match “${query}”.`,
  loadError:
    "Available units could not be loaded. Check your connection and try again.",
  retry: "Try again",
  selected: "Selected",
};

/**
 * Inline, always-visible picker for available units. Replaces the closed
 * combobox so the operator can see and compare the facts that decide the pick
 * (type, project, capacity, price) and select with one click. Selection uses the
 * terracotta spotlight (primary) per the admin design system.
 */
export function AvailableUnitPicker({
  units,
  value,
  onChange,
  unitTypeFilter,
  onUnitTypeFilterChange,
  hasValidRange,
  isRefreshing,
  isError = false,
  onRetry,
  labels: labelOverrides,
  disabled = false,
}: AvailableUnitPickerProps) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const typeChips = TYPE_CHIPS.map((chip) =>
    chip.value ? chip : { ...chip, label: labels.allTypes }
  );

  const visibleUnits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.projectName.toLowerCase().includes(q)
    );
  }, [units, query]);

  if (!hasValidRange) {
    return (
      <div className="rounded-[var(--portal-radius-control)] border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
        Select a date range above to see available units.
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        {typeChips.map((chip) => {
          const active = unitTypeFilter === chip.value;
          return (
            <button
              key={chip.value || "all"}
              type="button"
              disabled={disabled}
              onClick={() => onUnitTypeFilterChange(chip.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              {chip.label}
            </button>
          );
        })}
        <span className="ms-auto text-xs text-neutral-500">
          {isRefreshing
            ? labels.refreshing
            : labels.availableCount(units.length)}
        </span>
      </div>

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          {labels.search}
        </label>
        <Search
          aria-hidden="true"
          size={15}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          id={searchId}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.search}
          disabled={disabled || (units.length === 0 && !query)}
          className="h-[var(--portal-control-height)] w-full rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white pe-3 ps-9 text-sm text-neutral-800 placeholder:text-neutral-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50"
        />
      </div>

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-[var(--portal-radius-control)] border border-error-bg bg-error-bg px-4 py-8 text-center text-sm text-error"
        >
          <p>{labels.loadError}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-10 rounded-[var(--portal-radius-control)] border border-error px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
            >
              {labels.retry}
            </button>
          )}
        </div>
      ) : isRefreshing ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-[var(--portal-radius-control)] border border-neutral-200 px-4 py-8 text-sm text-neutral-500"
        >
          <Loader2 aria-hidden="true" size={16} className="animate-spin" />
          {labels.loading}
        </div>
      ) : units.length === 0 ? (
        <p className="rounded-[var(--portal-radius-control)] border border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          {labels.noUnits}
        </p>
      ) : visibleUnits.length === 0 ? (
        <p className="rounded-[var(--portal-radius-control)] border border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          {labels.noSearchResults(query.trim())}
        </p>
      ) : (
        <div className="grid max-h-[min(48dvh,32rem)] grid-cols-1 gap-2 overflow-y-auto overscroll-contain pe-1 sm:grid-cols-2">
          {visibleUnits.map((unit) => {
            const selected = unit.id === value;
            return (
              <button
                key={unit.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(selected ? null : unit.id)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[var(--portal-radius-control)] border p-3 text-start transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500",
                  selected
                    ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                    : "border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-medium text-neutral-900">
                    {unit.name}
                  </span>
                  {selected && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-700">
                      <Check aria-hidden="true" size={16} />
                      {labels.selected}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-[2px] text-xs text-neutral-700">
                    {UNIT_TYPE_LABELS[unit.unitType]}
                  </span>
                  <span className="truncate text-xs text-neutral-500">
                    {unit.projectName}
                  </span>
                </div>
                <p className="text-xs text-neutral-600">
                  {unit.maxGuests} {unit.maxGuests === 1 ? "guest" : "guests"} ·{" "}
                  {unit.bedrooms} bd · {unit.bathrooms} ba
                </p>
                <p className="text-xs font-medium text-neutral-800">
                  {formatCurrency(unit.basePricePerNight)} / night
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
