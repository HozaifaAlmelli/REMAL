import { CalendarDays, Contact, Home, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDateRange, getNights } from "@/lib/utils/format";
import { UNIT_TYPE_LABELS } from "@/lib/constants/unit-types";
import type { UnitListItemResponse } from "@/lib/types/unit.types";
import type {
  CrmBookingWizardCopy,
  CrmBookingWizardStepId,
} from "./crm-booking-wizard";
import type { CrmBookingWizardState } from "./useCrmBookingWizard";

interface CrmBookingWizardSummaryProps {
  state: CrmBookingWizardState;
  selectedUnit: UnitListItemResponse | null;
  copy: CrmBookingWizardCopy;
  className?: string;
  compact?: boolean;
  onEdit: (step: CrmBookingWizardStepId) => void;
  canEditUnit: boolean;
  canEditClient: boolean;
  canEditStay: boolean;
}

function SummaryContent({
  state,
  selectedUnit,
  copy,
  onEdit,
  canEditUnit,
  canEditClient,
  canEditStay,
}: Omit<CrmBookingWizardSummaryProps, "className" | "compact">) {
  const hasStay = Boolean(state.checkInDate && state.checkOutDate);
  const nights = hasStay
    ? getNights(state.checkInDate, state.checkOutDate)
    : 0;

  return (
    <dl className="divide-y divide-neutral-200">
      <div className="py-3 first:pt-0">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-xs font-medium text-neutral-500">
            <CalendarDays aria-hidden="true" size={14} />
            {copy.requestedStay}
          </dt>
          {canEditStay && (
            <button
              type="button"
              onClick={() => onEdit("stay")}
              className="min-h-10 text-xs font-medium text-primary-700 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {copy.edit}
            </button>
          )}
        </div>
        <dd className="mt-1 text-sm font-medium tabular-nums text-neutral-800">
          {hasStay
            ? formatDateRange(state.checkInDate, state.checkOutDate)
            : copy.notProvided}
        </dd>
        {nights > 0 && (
          <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
            {copy.nights(nights)}
          </p>
        )}
      </div>

      <div className="py-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-xs font-medium text-neutral-500">
            <Home aria-hidden="true" size={14} />
            {copy.unit}
          </dt>
          {canEditUnit && (
            <button
              type="button"
              onClick={() => onEdit("unit")}
              className="min-h-10 text-xs font-medium text-primary-700 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {copy.edit}
            </button>
          )}
        </div>
        <dd className="mt-1 text-sm font-medium text-neutral-800">
          {selectedUnit?.name ?? copy.notProvided}
        </dd>
        {selectedUnit && (
          <p className="mt-0.5 text-xs text-neutral-500">
            {UNIT_TYPE_LABELS[selectedUnit.unitType]} ·{" "}
            {formatCurrency(selectedUnit.basePricePerNight)} {copy.perNight}
          </p>
        )}
      </div>

      <div className="py-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-xs font-medium text-neutral-500">
            <Contact aria-hidden="true" size={14} />
            {copy.client}
          </dt>
          {canEditClient && (
            <button
              type="button"
              onClick={() => onEdit("client")}
              className="min-h-10 text-xs font-medium text-primary-700 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {copy.edit}
            </button>
          )}
        </div>
        <dd className="mt-1 truncate text-sm font-medium text-neutral-800">
          {state.client?.name ?? copy.notProvided}
        </dd>
        {state.client?.phone && (
          <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
            {state.client.phone}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 py-3 last:pb-0">
        <Users aria-hidden="true" size={14} className="text-neutral-500" />
        <dt className="text-xs font-medium text-neutral-500">{copy.guests}</dt>
        <dd className="ms-auto text-sm font-medium tabular-nums text-neutral-800">
          {copy.guestCount(state.guestCount)}
        </dd>
      </div>
    </dl>
  );
}
export function CrmBookingWizardSummary({
  className,
  compact = false,
  ...props
}: CrmBookingWizardSummaryProps) {
  if (compact) {
    return (
      <details
        className={cn(
          "rounded-[var(--portal-radius-control)] border border-neutral-200 bg-neutral-50",
          className
        )}
      >
        <summary className="min-h-11 cursor-pointer px-3.5 py-3 text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
          {props.copy.leadSummary}
        </summary>
        <div className="border-t border-neutral-200 px-3.5 py-3">
          <SummaryContent {...props} />
        </div>
      </details>
    );
  }

  return (
    <aside
      aria-label={props.copy.leadSummary}
      className={cn(
        "rounded-[var(--portal-radius-control)] border border-neutral-200 bg-neutral-50 p-4",
        className
      )}
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {props.copy.leadSummary}
      </h3>
      <SummaryContent {...props} />
    </aside>
  );
}
