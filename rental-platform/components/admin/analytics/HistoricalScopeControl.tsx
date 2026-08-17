import type { HistoricalScope } from "@/lib/types/report.types";
import { HISTORICAL_SCOPE_OPTIONS } from "@/lib/historical-reporting/presentation";
import { cn } from "@/lib/utils/cn";

interface HistoricalScopeControlProps {
  value: HistoricalScope;
  onChange: (value: HistoricalScope) => void;
  label?: string;
}

export function HistoricalScopeControl({
  value,
  onChange,
  label = "Booking type",
}: HistoricalScopeControlProps) {
  return (
    <div
      className="inline-flex min-h-10 items-center rounded-[var(--portal-radius-control)] border border-neutral-200 bg-white p-1"
      role="group"
      aria-label={label}
    >
      {HISTORICAL_SCOPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-8 px-3 text-sm font-medium transition-colors",
            value === option.value
              ? "rounded bg-neutral-900 text-white"
              : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
