import type { RefObject } from "react";
import {
  CalendarDays,
  Check,
  CircleAlert,
  Copy,
  Info,
  UserRound,
} from "lucide-react";
import { AvailableUnitPicker } from "../AvailableUnitPicker";
import { formatCurrency, formatDateRange, getNights } from "@/lib/utils/format";
import { UNIT_TYPE_LABELS } from "@/lib/constants/unit-types";
import type { UnitListItemResponse } from "@/lib/types/unit.types";
import type { UnitType } from "@/lib/types/unit.types";
import type {
  CrmBookingWizardCopy,
  CrmBookingWizardStepId,
} from "./crm-booking-wizard";
import type {
  CrmBookingWizardState,
  WizardClientDraft,
} from "./useCrmBookingWizard";

interface StepHeadingProps {
  title: string;
  description: string;
  headingRef: RefObject<HTMLHeadingElement>;
}

function StepHeading({
  title,
  description,
  headingRef,
}: StepHeadingProps) {
  return (
    <header>
      <h3
        ref={headingRef}
        id="crm-booking-step-heading"
        tabIndex={-1}
        className="text-base font-semibold text-neutral-900 focus:outline-none"
      >
        {title}
      </h3>
      <p className="mt-1 max-w-[70ch] text-sm leading-6 text-neutral-600">
        {description}
      </p>
    </header>
  );
}

interface StayStepProps {
  state: CrmBookingWizardState;
  copy: CrmBookingWizardCopy;
  headingRef: RefObject<HTMLHeadingElement>;
  checkInLocked: boolean;
  checkOutLocked: boolean;
  lockedInvalid: boolean;
  dateError: string | null;
  onChange: (checkInDate: string, checkOutDate: string) => void;
}

export function StayStep({
  state,
  copy,
  headingRef,
  checkInLocked,
  checkOutLocked,
  lockedInvalid,
  dateError,
  onChange,
}: StayStepProps) {
  const errorId = dateError || lockedInvalid ? "wizard-stay-error" : undefined;

  return (
    <div className="space-y-6">
      <StepHeading
        title={copy.stayTitle}
        description={copy.stayDescription}
        headingRef={headingRef}
      />

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="wizard-check-in"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            {copy.checkIn}
          </label>
          <input
            id="wizard-check-in"
            type="date"
            value={state.checkInDate}
            disabled={checkInLocked}
            aria-invalid={Boolean(errorId)}
            aria-describedby={errorId}
            onChange={(event) =>
              onChange(event.target.value, state.checkOutDate)
            }
            className="h-[var(--portal-control-height)] w-full rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white px-3.5 text-sm tabular-nums text-neutral-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500"
          />
        </div>

        <div>
          <label
            htmlFor="wizard-check-out"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            {copy.checkOut}
          </label>
          <input
            id="wizard-check-out"
            type="date"
            value={state.checkOutDate}
            min={state.checkInDate || undefined}
            disabled={checkOutLocked}
            aria-invalid={Boolean(errorId)}
            aria-describedby={errorId}
            onChange={(event) =>
              onChange(state.checkInDate, event.target.value)
            }
            className="h-[var(--portal-control-height)] w-full rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white px-3.5 text-sm tabular-nums text-neutral-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500"
          />
        </div>
      </div>

      {(dateError || lockedInvalid) && (
        <p
          id="wizard-stay-error"
          role="alert"
          className="flex max-w-2xl items-start gap-2 text-sm text-error"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          {lockedInvalid ? copy.stayLockedError : dateError}
        </p>
      )}
    </div>
  );
}

interface UnitStepProps {
  state: CrmBookingWizardState;
  copy: CrmBookingWizardCopy;
  headingRef: RefObject<HTMLHeadingElement>;
  units: UnitListItemResponse[];
  isRefreshing: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (unitId: string | null) => void;
  onUnitTypeChange: (unitType: "" | UnitType) => void;
  disabled: boolean;
}

export function UnitStep({
  state,
  copy,
  headingRef,
  units,
  isRefreshing,
  isError,
  onRetry,
  onSelect,
  onUnitTypeChange,
  disabled,
}: UnitStepProps) {
  const nights = getNights(state.checkInDate, state.checkOutDate);

  return (
    <div className="space-y-5">
      <StepHeading
        title={copy.chooseUnitTitle}
        description={copy.chooseUnitDescription}
        headingRef={headingRef}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-neutral-200 py-3 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5 tabular-nums">
          <CalendarDays aria-hidden="true" size={14} />
          {formatDateRange(state.checkInDate, state.checkOutDate)}
        </span>
        <span className="tabular-nums">{copy.nights(nights)}</span>
        <span className="tabular-nums">
          {copy.guestCount(state.guestCount)}
        </span>
      </div>

      {state.conflictMessage && (
        <div
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2.5 rounded-[var(--portal-radius-control)] border border-error-bg bg-error-bg p-3 text-sm text-error focus:outline-none focus:ring-2 focus:ring-error"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
          <p>{state.conflictMessage}</p>
        </div>
      )}

      <AvailableUnitPicker
        units={units}
        value={state.selectedUnitId}
        onChange={onSelect}
        unitTypeFilter={state.unitTypeFilter}
        onUnitTypeFilterChange={onUnitTypeChange}
        hasValidRange
        isRefreshing={isRefreshing}
        isError={isError}
        onRetry={onRetry}
        disabled={disabled}
        labels={{
          allTypes: copy.allTypes,
          availableCount: copy.availableCount,
          refreshing: copy.refreshing,
          search: copy.searchUnits,
          loading: copy.loadingUnits,
          noUnits: copy.noUnits,
          noSearchResults: copy.noSearchResults,
          loadError: copy.unitLoadError,
          retry: copy.retry,
          selected: copy.selected,
        }}
      />
    </div>
  );
}

export interface ClientValidationErrors {
  name?: string;
  phone?: string;
  email?: string;
}

interface ClientStepProps {
  state: CrmBookingWizardState;
  copy: CrmBookingWizardCopy;
  headingRef: RefObject<HTMLHeadingElement>;
  validationErrors: ClientValidationErrors;
  isLoading: boolean;
  onDraftChange: (draft: Partial<WizardClientDraft>) => void;
  onSubmit: () => void;
  onChangeClient: () => void;
}

export function ClientStep({
  state,
  copy,
  headingRef,
  validationErrors,
  isLoading,
  onDraftChange,
  onSubmit,
  onChangeClient,
}: ClientStepProps) {
  return (
    <div className="space-y-6">
      <StepHeading
        title={copy.clientTitle}
        description={copy.clientDescription}
        headingRef={headingRef}
      />

      {state.client ? (
        <div className="flex max-w-2xl items-start justify-between gap-4 border-y border-neutral-200 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success-bg text-success">
              <UserRound aria-hidden="true" size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-neutral-500">
                {copy.linkedClient}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">
                {state.client.name}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-neutral-600">
                {state.client.phone}
              </p>
              {state.client.email && (
                <p className="mt-0.5 truncate text-xs text-neutral-600">
                  {state.client.email}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onChangeClient}
            className="min-h-10 shrink-0 text-xs font-medium text-primary-700 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {copy.changeClient}
          </button>
        </div>
      ) : (
        <form
          id="crm-booking-client-form"
          className="grid max-w-2xl gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          onKeyDown={(event) => {
            if (
              event.key !== "Enter" ||
              event.defaultPrevented ||
              event.nativeEvent.isComposing
            ) {
              return;
            }
            event.preventDefault();
            onSubmit();
          }}
          noValidate
        >
          <WizardField
            id="wizard-client-name"
            label={copy.fullName}
            value={state.clientDraft.name}
            error={validationErrors.name}
            disabled={isLoading}
            autoComplete="name"
            onChange={(value) => onDraftChange({ name: value })}
          />
          <WizardField
            id="wizard-client-phone"
            label={copy.phone}
            value={state.clientDraft.phone}
            error={validationErrors.phone}
            disabled={isLoading}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            onChange={(value) => onDraftChange({ phone: value })}
          />
          <WizardField
            id="wizard-client-email"
            label={copy.emailOptional}
            value={state.clientDraft.email}
            error={validationErrors.email}
            disabled={isLoading}
            type="email"
            autoComplete="email"
            onChange={(value) => onDraftChange({ email: value })}
          />

          {state.clientError && (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-error"
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                size={16}
              />
              {state.clientError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

interface WizardFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email";
  autoComplete?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function WizardField({
  id,
  label,
  value,
  error,
  type = "text",
  inputMode,
  autoComplete,
  disabled,
  onChange,
}: WizardFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-neutral-700"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
        className="h-[var(--portal-control-height)] w-full rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white px-3.5 text-sm text-neutral-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-neutral-50"
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

interface BookingDetailsStepProps {
  state: CrmBookingWizardState;
  copy: CrmBookingWizardCopy;
  headingRef: RefObject<HTMLHeadingElement>;
  selectedUnit: UnitListItemResponse | null;
  isLoading: boolean;
  guestError: string | null;
  onGuestCountChange: (count: number) => void;
  onNotesChange: (notes: string) => void;
}

export function BookingDetailsStep({
  state,
  copy,
  headingRef,
  selectedUnit,
  isLoading,
  guestError,
  onGuestCountChange,
  onNotesChange,
}: BookingDetailsStepProps) {
  const guestErrorId = guestError ? "wizard-guests-error" : undefined;

  return (
    <div className="space-y-6">
      <StepHeading
        title={copy.bookingTitle}
        description={copy.bookingDescription}
        headingRef={headingRef}
      />

      <div className="grid max-w-2xl gap-5">
        <div>
          <label
            htmlFor="wizard-guests"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            {copy.guests}
          </label>
          <input
            id="wizard-guests"
            type="number"
            inputMode="numeric"
            min={1}
            max={selectedUnit?.maxGuests}
            step={1}
            value={state.guestCount}
            disabled={isLoading}
            aria-invalid={Boolean(guestError)}
            aria-describedby={guestErrorId}
            onKeyDown={(event) => {
              if (["-", "+", "e", "E", "."].includes(event.key)) {
                event.preventDefault();
              }
            }}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onGuestCountChange(
                Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0
              );
            }}
            className="h-[var(--portal-control-height)] w-full rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white px-3.5 text-sm tabular-nums text-neutral-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-neutral-50"
          />
          {selectedUnit && !guestError && (
            <p className="mt-1.5 text-xs text-neutral-500">
              {copy.capacity(selectedUnit.name, selectedUnit.maxGuests)}
            </p>
          )}
          {guestError && (
            <p id={guestErrorId} className="mt-1.5 text-xs text-error">
              {guestError}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="wizard-internal-notes"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            {copy.internalNotes}
          </label>
          <textarea
            id="wizard-internal-notes"
            value={state.internalNotes}
            disabled={isLoading}
            placeholder={copy.notesPlaceholder}
            onChange={(event) => onNotesChange(event.target.value)}
            className="min-h-28 w-full resize-y rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white p-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-neutral-50"
          />
        </div>
      </div>
    </div>
  );
}

interface ReviewStepProps {
  state: CrmBookingWizardState;
  copy: CrmBookingWizardCopy;
  headingRef: RefObject<HTMLHeadingElement>;
  selectedUnit: UnitListItemResponse;
  onEdit: (step: CrmBookingWizardStepId) => void;
  canEditStay: boolean;
  canEditUnit: boolean;
  canEditClient: boolean;
}

export function ReviewStep({
  state,
  copy,
  headingRef,
  selectedUnit,
  onEdit,
  canEditStay,
  canEditUnit,
  canEditClient,
}: ReviewStepProps) {
  const nights = getNights(state.checkInDate, state.checkOutDate);

  return (
    <div className="space-y-6">
      <StepHeading
        title={copy.reviewTitle}
        description={copy.reviewDescription}
        headingRef={headingRef}
      />

      <div className="divide-y divide-neutral-200 border-y border-neutral-200">
        <ReviewGroup
          title={copy.stayGroup}
          canEdit={canEditStay}
          copy={copy}
          onEdit={() => onEdit("stay")}
        >
          <p className="font-medium tabular-nums text-neutral-900">
            {formatDateRange(state.checkInDate, state.checkOutDate)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-neutral-500">
            {copy.nights(nights)} · {copy.guestCount(state.guestCount)}
          </p>
        </ReviewGroup>

        <ReviewGroup
          title={copy.unitGroup}
          canEdit={canEditUnit}
          copy={copy}
          onEdit={() => onEdit("unit")}
        >
          <p className="font-medium text-neutral-900">{selectedUnit.name}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {UNIT_TYPE_LABELS[selectedUnit.unitType]} ·{" "}
            {selectedUnit.projectName}
          </p>
          <p className="mt-1 text-xs font-medium tabular-nums text-neutral-700">
            {formatCurrency(selectedUnit.basePricePerNight)} {copy.perNight}
          </p>
        </ReviewGroup>

        <ReviewGroup
          title={copy.clientGroup}
          canEdit={canEditClient}
          copy={copy}
          onEdit={() => onEdit("client")}
        >
          <p className="font-medium text-neutral-900">{state.client!.name}</p>
          <p className="mt-1 text-xs tabular-nums text-neutral-500">
            {state.client!.phone}
          </p>
          {state.client!.email && (
            <p className="mt-1 text-xs text-neutral-500">
              {state.client!.email}
            </p>
          )}
        </ReviewGroup>

        <ReviewGroup
          title={copy.bookingGroup}
          canEdit
          copy={copy}
          onEdit={() => onEdit("booking")}
        >
          <p className="whitespace-pre-wrap text-sm text-neutral-700">
            {state.internalNotes.trim() || copy.noNotes}
          </p>
        </ReviewGroup>
      </div>

      <div className="flex items-start gap-2.5 rounded-[var(--portal-radius-control)] bg-info-bg p-3 text-sm text-info">
        <Info aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
        <p>{copy.availabilityNotice}</p>
      </div>

      {state.submissionError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[var(--portal-radius-control)] border border-error-bg bg-error-bg p-3 text-sm text-error"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
          <p>{state.submissionError}</p>
        </div>
      )}
    </div>
  );
}

interface ReviewGroupProps {
  title: string;
  canEdit: boolean;
  copy: CrmBookingWizardCopy;
  onEdit: () => void;
  children: React.ReactNode;
}

function ReviewGroup({
  title,
  canEdit,
  copy,
  onEdit,
  children,
}: ReviewGroupProps) {
  return (
    <section className="grid gap-3 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h4>
      <div className="min-w-0 text-sm">{children}</div>
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="min-h-10 self-start text-start text-xs font-medium text-primary-700 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {copy.edit}
        </button>
      )}
    </section>
  );
}

interface TemporaryPasswordNoticeProps {
  password: string;
  copy: CrmBookingWizardCopy;
  copied: boolean;
  onCopy: () => void;
}

export function TemporaryPasswordNotice({
  password,
  copy,
  copied,
  onCopy,
}: TemporaryPasswordNoticeProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--portal-radius-control)] border border-warning-bg bg-warning-bg p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-warning">
          {copy.temporaryPassword}
        </p>
        <code className="mt-1 block break-all font-mono text-sm text-neutral-900">
          {password}
        </code>
        <p className="mt-1 text-xs text-warning">{copy.temporaryPasswordHint}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copy.copyPassword}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--portal-radius-control)] border border-warning bg-white px-3 text-xs font-medium text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2"
      >
        {copied ? (
          <Check aria-hidden="true" size={15} />
        ) : (
          <Copy aria-hidden="true" size={15} />
        )}
        {copied ? copy.copied : copy.copyPassword}
      </button>
    </div>
  );
}
