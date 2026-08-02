"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileClock,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useClients } from "@/lib/hooks/useClients";
import { useInternalUnitsList } from "@/lib/hooks/useUnits";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useAuthStore } from "@/lib/stores/auth.store";
import { ROUTES } from "@/lib/constants/routes";
import {
  HISTORICAL_ENTRY_REASONS,
  HISTORICAL_ORIGINAL_SOURCES,
  HISTORICAL_PAYMENT_METHODS,
} from "@/lib/constants/historical-bookings";
import { historicalBookingsService } from "@/lib/api/services/historical-bookings.service";
import { ApiError } from "@/lib/api/api-error";
import {
  bookingErrorMessage,
  ownerReviewIssue,
  paymentErrorMessage,
  toHistoricalWizardConflict,
} from "@/lib/historical-bookings/errors";
import {
  buildHistoricalBookingRequest,
  buildHistoricalPaymentRequest,
  createInitialHistoricalWizardState,
  historicalWizardReducer,
  resolveCommandIdentity,
  validateAllHistoricalWizardSteps,
  validateHistoricalPaymentDraft,
  validateHistoricalWizardStep,
  type CommandIdentity,
  type HistoricalBookingDraft,
  type HistoricalWizardStep,
} from "@/lib/historical-bookings/wizard";
import type { HistoricalPaymentResponse } from "@/lib/types/historical-booking.types";
import { HistoricalWizardStepper } from "./HistoricalWizardStepper";
import { cn } from "@/lib/utils/cn";

const REQUIRED_WARNINGS = [
  "This records a completed historical stay, not a new reservation.",
  "Audit timestamps record today's system action, not the original booking date.",
  "Reports and owner accounting will include the persisted historical record.",
  "No automatic notification, invoice, payout, or external integration is created.",
  "A manual invoice may be created later; historical payment evidence remains standalone.",
] as const;

const BOOKING_HISTORY_STATE_KEY = "hb06HistoricalBookingId";
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fieldId: Record<string, string> = {
  originalSource: "historical-original-source",
  actualBookedAt: "historical-actual-booked-at",
  historicalEntryReason: "historical-entry-reason",
  historicalEntryNote: "historical-entry-note",
  externalReference: "historical-external-reference",
  unitId: "historical-unit",
  checkInDate: "historical-check-in",
  checkOutDate: "historical-check-out",
  clientId: "historical-client",
  newClientName: "historical-client-name",
  newClientPhone: "historical-client-phone",
  newClientEmail: "historical-client-email",
  guestCount: "historical-guest-count",
  internalNotes: "historical-internal-notes",
  agreedAmount: "historical-agreed-amount",
};

function safeMoney(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (amount === null || amount === undefined || !Number.isFinite(amount))
    return "—";
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 2,
  }).format(amount);
}

function compactId(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-neutral-100 py-2.5 last:border-0 sm:grid-cols-[180px_1fr]">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-neutral-800">
        {value || "—"}
      </dd>
    </div>
  );
}

function FieldErrorSummary({ errors }: { errors: Record<string, string> }) {
  const messages = Object.values(errors);
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-s-4 border-error bg-error-bg px-4 py-3"
    >
      <p className="text-sm font-semibold text-error">Review this step</p>
      <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-700">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="border-b border-neutral-200 pb-4">
      <p className="text-xs font-semibold uppercase text-primary-700">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">
        {description}
      </p>
    </header>
  );
}

export function HistoricalBookingWizard() {
  const router = useRouter();
  const permissions = usePermissions();
  const grants = useAuthStore((state) => state.permissions);
  const [state, dispatch] = useReducer(
    historicalWizardReducer,
    undefined,
    createInitialHistoricalWizardState
  );
  const [furthestStep, setFurthestStep] = useState<HistoricalWizardStep>(1);
  const bookingIdentity = useRef<CommandIdentity | null>(null);
  const paymentIdentity = useRef<CommandIdentity | null>(null);
  const bookingSubmitting = useRef(false);
  const paymentSubmitting = useRef(false);
  const recoveryStarted = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const canLoadUnits = grants.includes("units:read");
  const canLoadClients = grants.includes("clients:read");
  const units = useInternalUnitsList(
    { includeInactive: true, page: 1, pageSize: 100 },
    { enabled: permissions.canRecordHistoricalBookings && canLoadUnits }
  );
  const clients = useClients(
    { includeInactive: true, page: 1, pageSize: 100 },
    { enabled: permissions.canRecordHistoricalBookings && canLoadClients }
  );

  const selectedUnit = units.data?.items.find(
    (unit) => unit.id === state.draft.unitId
  );
  const selectedClient = clients.data?.items.find(
    (client) => client.id === state.draft.clientId
  );
  const committed = Boolean(state.booking);
  const bookingPending = state.phase === "BookingSubmitting";
  const paymentPending = state.phase === "PaymentSubmitting";

  useEffect(() => {
    if (!permissions.canRecordHistoricalBookings) {
      router.replace(ROUTES.admin.bookings.list);
    }
  }, [permissions.canRecordHistoricalBookings, router]);

  useEffect(() => {
    if (
      committed ||
      (state.currentStep === 1 &&
        Object.values(state.draft).every((value) =>
          Array.isArray(value)
            ? value.length === 0
            : value === "" || value === "1" || value === "existing"
        ))
    )
      return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [committed, state.currentStep, state.draft]);

  useEffect(() => {
    if (Object.keys(state.validationErrors).length > 0) {
      errorSummaryRef.current?.focus();
      const first = Object.keys(state.validationErrors)[0];
      if (first) document.getElementById(fieldId[first] ?? first)?.focus();
    }
  }, [state.validationErrors]);

  const updateDraft = useCallback((patch: Partial<HistoricalBookingDraft>) => {
    dispatch({ type: "updateDraft", patch });
  }, []);

  const next = () => {
    const result = validateHistoricalWizardStep(state.currentStep, state.draft);
    if (!result.valid) {
      dispatch({ type: "validationFailed", errors: result.errors });
      return;
    }
    if (state.currentStep < 6) {
      const nextStep = (state.currentStep + 1) as HistoricalWizardStep;
      setFurthestStep(
        (current) => Math.max(current, nextStep) as HistoricalWizardStep
      );
      dispatch({ type: "goToStep", step: nextStep });
    }
  };

  const back = () => {
    if (state.currentStep > 1 && !committed) {
      dispatch({
        type: "goToStep",
        step: (state.currentStep - 1) as HistoricalWizardStep,
      });
    }
  };

  const loadOwnerReview = useCallback(async (bookingId: string) => {
    try {
      const review =
        await historicalBookingsService.reviewOwnerAttribution(bookingId);
      dispatch({ type: "ownerReviewLoaded", review });
    } catch (error) {
      const issue = ownerReviewIssue(error);
      dispatch({
        type:
          issue.kind === "review-required"
            ? "ownerReviewRequired"
            : "ownerReviewUnavailable",
        issue,
      });
    }
  }, []);

  useEffect(() => {
    if (state.booking || recoveryStarted.current) return;
    const retained = (window.history.state as Record<string, unknown> | null)?.[
      BOOKING_HISTORY_STATE_KEY
    ];
    if (typeof retained !== "string" || !GUID_PATTERN.test(retained)) return;
    recoveryStarted.current = true;
    dispatch({ type: "bookingRecovered", bookingId: retained });
    void loadOwnerReview(retained);
  }, [loadOwnerReview, state.booking]);

  const submitBooking = async () => {
    if (bookingSubmitting.current || committed) return;
    const validation = validateAllHistoricalWizardSteps(state.draft);
    if (!validation.valid) {
      dispatch({ type: "validationFailed", errors: validation.errors });
      return;
    }
    const request = buildHistoricalBookingRequest(state.draft);
    bookingIdentity.current = resolveCommandIdentity(
      bookingIdentity.current,
      request
    );
    bookingSubmitting.current = true;
    dispatch({ type: "bookingSubmitting" });
    try {
      const booking = await historicalBookingsService.recordBooking(
        request,
        bookingIdentity.current.key
      );
      window.history.replaceState(
        { ...window.history.state, [BOOKING_HISTORY_STATE_KEY]: booking.id },
        "",
        window.location.href
      );
      recoveryStarted.current = true;
      dispatch({ type: "bookingCreated", booking });
      void loadOwnerReview(booking.id);
    } catch (error) {
      dispatch({
        type: "bookingFailed",
        message: bookingErrorMessage(error),
        conflict:
          error instanceof ApiError
            ? (toHistoricalWizardConflict(error) ?? undefined)
            : undefined,
      });
    } finally {
      bookingSubmitting.current = false;
    }
  };

  const retryOwnerReview = () => {
    if (!state.booking || !state.ownerReviewIssue?.retryable) return;
    dispatch({ type: "ownerReviewRetrying" });
    void loadOwnerReview(state.booking.id);
  };

  const submitPayment = async () => {
    if (!state.booking || paymentSubmitting.current || state.payment) return;
    const validation = validateHistoricalPaymentDraft(state.paymentDraft);
    if (!validation.valid) {
      dispatch({ type: "validationFailed", errors: validation.errors });
      return;
    }
    const request = buildHistoricalPaymentRequest(state.paymentDraft);
    paymentIdentity.current = resolveCommandIdentity(
      paymentIdentity.current,
      request
    );
    paymentSubmitting.current = true;
    dispatch({ type: "paymentSubmitting" });
    try {
      const payment = await historicalBookingsService.recordPayment(
        state.booking.id,
        request,
        paymentIdentity.current.key
      );
      dispatch({ type: "paymentRecorded", payment });
    } catch (error) {
      dispatch({ type: "paymentFailed", message: paymentErrorMessage(error) });
    } finally {
      paymentSubmitting.current = false;
    }
  };

  const acknowledgeConflicts = () => {
    if (!state.conflict) return;
    updateDraft({
      acknowledgedDuplicateOf: state.conflict.candidates.map(
        (item) => item.bookingId
      ),
      acknowledgedDateBlockIds: state.conflict.dateBlocks.map(
        (item) => item.dateBlockId
      ),
    });
    bookingIdentity.current = null;
  };

  if (!permissions.canRecordHistoricalBookings) return null;

  if (state.booking) {
    return (
      <BookingCreatedView
        state={state}
        canRecordPayment={permissions.canRecordHistoricalPayments}
        paymentPending={paymentPending}
        onRetryOwnerReview={retryOwnerReview}
        onUpdatePayment={(patch) =>
          dispatch({ type: "updatePaymentDraft", patch })
        }
        onSubmitPayment={submitPayment}
      />
    );
  }

  return (
    <div
      className="mx-auto max-w-6xl space-y-4"
      data-testid="historical-booking-wizard"
    >
      <header className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={ROUTES.admin.bookings.list}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft aria-hidden size={14} /> Bookings
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">
            Record historical booking
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Create one completed booking from trusted historical records.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
          <LockKeyhole aria-hidden size={15} className="text-primary-600" />
          Privileged internal workflow
        </div>
      </header>

      <section className="overflow-hidden border border-neutral-200 bg-white shadow-sm">
        <HistoricalWizardStepper
          currentStep={state.currentStep}
          furthestStep={furthestStep}
          disabled={bookingPending}
          onStepSelect={(step) => dispatch({ type: "goToStep", step })}
        />

        <div className="p-4 sm:p-6">
          <div ref={errorSummaryRef} tabIndex={-1} className="outline-none">
            <FieldErrorSummary errors={state.validationErrors} />
          </div>
          {state.bookingError && (
            <div
              role="alert"
              className="mt-4 border-s-4 border-error bg-error-bg px-4 py-3 text-sm text-neutral-800"
            >
              <p className="font-semibold text-error">Booking not created</p>
              <p className="mt-1">{state.bookingError}</p>
            </div>
          )}
          {state.conflict && (
            <ConflictPanel
              conflict={state.conflict}
              onAcknowledge={acknowledgeConflicts}
            />
          )}

          <div className="mt-5 min-h-[360px]">
            {state.currentStep === 1 && (
              <ProvenanceStep
                draft={state.draft}
                errors={state.validationErrors}
                onChange={updateDraft}
              />
            )}
            {state.currentStep === 2 && (
              <StayStep
                draft={state.draft}
                errors={state.validationErrors}
                units={units.data?.items ?? []}
                isLoading={units.isLoading}
                canLoad={canLoadUnits}
                onChange={updateDraft}
              />
            )}
            {state.currentStep === 3 && (
              <ClientStep
                draft={state.draft}
                errors={state.validationErrors}
                clients={clients.data?.items ?? []}
                isLoading={clients.isLoading}
                canLoad={canLoadClients}
                onChange={updateDraft}
              />
            )}
            {state.currentStep === 4 && (
              <FinancialStep
                draft={state.draft}
                errors={state.validationErrors}
                selectedUnit={selectedUnit}
                onChange={updateDraft}
              />
            )}
            {state.currentStep === 5 && <OwnerPolicyStep />}
            {state.currentStep === 6 && (
              <ReviewStep
                draft={state.draft}
                unitName={selectedUnit?.name}
                clientName={selectedClient?.name}
              />
            )}
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={back}
              disabled={state.currentStep === 1 || bookingPending}
              leftIcon={<ArrowLeft aria-hidden size={16} />}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={bookingPending}
              onClick={() => {
                if (window.confirm("Discard this historical booking draft?"))
                  router.push(ROUTES.admin.bookings.list);
              }}
            >
              Cancel
            </Button>
          </div>
          {state.currentStep < 6 ? (
            <Button
              type="button"
              onClick={next}
              rightIcon={<ArrowRight aria-hidden size={16} />}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              onClick={submitBooking}
              isLoading={bookingPending}
              leftIcon={<ClipboardCheck aria-hidden size={16} />}
            >
              Record historical booking
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}

function ProvenanceStep({ draft, errors, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <StepHeading
        eyebrow="Step 1 of 6"
        title="Provenance"
        description="Record where the booking came from and why it is being entered after the stay."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          id={fieldId.originalSource}
          label="Original source"
          required
          value={draft.originalSource}
          error={errors.originalSource}
          placeholder="Select source"
          options={[...HISTORICAL_ORIGINAL_SOURCES]}
          onChange={(value) =>
            onChange({
              originalSource: value as HistoricalBookingDraft["originalSource"],
            })
          }
        />
        <Input
          id={fieldId.actualBookedAt}
          type="date"
          label="Original booking date"
          required
          value={draft.actualBookedAt}
          error={errors.actualBookedAt}
          onChange={(event) => onChange({ actualBookedAt: event.target.value })}
        />
        <Select
          id={fieldId.historicalEntryReason}
          label="Entry reason"
          required
          value={draft.historicalEntryReason}
          error={errors.historicalEntryReason}
          placeholder="Select reason"
          options={[...HISTORICAL_ENTRY_REASONS]}
          onChange={(value) =>
            onChange({
              historicalEntryReason:
                value as HistoricalBookingDraft["historicalEntryReason"],
            })
          }
        />
        <Input
          id={fieldId.externalReference}
          label="External reference (optional)"
          maxLength={100}
          value={draft.externalReference}
          error={errors.externalReference}
          onChange={(event) =>
            onChange({ externalReference: event.target.value })
          }
        />
      </div>
      <Textarea
        id={fieldId.historicalEntryNote}
        label={
          draft.historicalEntryReason === "other"
            ? "Reason detail"
            : "Reason detail (optional)"
        }
        required={draft.historicalEntryReason === "other"}
        maxLength={1000}
        value={draft.historicalEntryNote}
        error={errors.historicalEntryNote}
        onChange={(event) =>
          onChange({ historicalEntryNote: event.target.value })
        }
      />
    </div>
  );
}

interface StepProps {
  draft: HistoricalBookingDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<HistoricalBookingDraft>) => void;
}

function StayStep({
  draft,
  errors,
  units,
  isLoading,
  canLoad,
  onChange,
}: StepProps & {
  units: Array<{
    id: string;
    name: string;
    projectName: string;
    isActive: boolean;
    maxGuests: number;
  }>;
  isLoading: boolean;
  canLoad: boolean;
}) {
  const options = units.map((unit) => ({
    value: unit.id,
    label: `${unit.name} · ${unit.projectName}${unit.isActive ? "" : " · Inactive"}`,
  }));
  return (
    <div className="space-y-5">
      <StepHeading
        eyebrow="Step 2 of 6"
        title="Unit and occupied dates"
        description="Inactive units remain selectable for truthful historical records. Deleted units are excluded by the server."
      />
      {!canLoad && (
        <div
          role="alert"
          className="border-s-4 border-warning bg-warning-bg px-4 py-3 text-sm"
        >
          Unit reference data requires the existing units:read permission.
        </div>
      )}
      <Combobox
        label="Unit"
        options={options}
        value={draft.unitId || null}
        disabled={!canLoad || isLoading}
        placeholder={isLoading ? "Loading units…" : "Search unit or project"}
        error={errors.unitId}
        onChange={(value) => onChange({ unitId: String(value ?? "") })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={fieldId.checkInDate}
          type="date"
          label="Check-in date"
          required
          value={draft.checkInDate}
          error={errors.checkInDate}
          onChange={(event) => onChange({ checkInDate: event.target.value })}
        />
        <Input
          id={fieldId.checkOutDate}
          type="date"
          label="Check-out date"
          required
          value={draft.checkOutDate}
          error={errors.checkOutDate}
          helperText="Checkout must be complete in Cairo time."
          onChange={(event) => onChange({ checkOutDate: event.target.value })}
        />
      </div>
    </div>
  );
}

function ClientStep({
  draft,
  errors,
  clients,
  isLoading,
  canLoad,
  onChange,
}: StepProps & {
  clients: Array<{
    id: string;
    name: string;
    phone: string;
    isActive: boolean;
  }>;
  isLoading: boolean;
  canLoad: boolean;
}) {
  return (
    <div className="space-y-5">
      <StepHeading
        eyebrow="Step 3 of 6"
        title="Client and stay details"
        description="Choose exactly one existing client or create one client atomically with the booking."
      />
      <div
        className="inline-flex border border-neutral-300 bg-neutral-50 p-1"
        role="group"
        aria-label="Client source"
      >
        {(["existing", "new"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ clientMode: mode })}
            className={cn(
              "min-h-9 px-4 text-sm font-medium",
              draft.clientMode === mode
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500"
            )}
          >
            {mode === "existing" ? "Existing client" : "New client"}
          </button>
        ))}
      </div>
      {draft.clientMode === "existing" ? (
        <>
          {!canLoad && (
            <div
              role="alert"
              className="border-s-4 border-warning bg-warning-bg px-4 py-3 text-sm"
            >
              Existing-client lookup requires the existing clients:read
              permission. Use new-client entry or request access.
            </div>
          )}
          <Combobox
            label="Existing client"
            options={clients.map((client) => ({
              value: client.id,
              label: `${client.name} · ${client.phone}${client.isActive ? "" : " · Inactive"}`,
            }))}
            value={draft.clientId || null}
            disabled={!canLoad || isLoading}
            placeholder={isLoading ? "Loading clients…" : "Search client"}
            error={errors.clientId}
            onChange={(value) => onChange({ clientId: String(value ?? "") })}
          />
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            id={fieldId.newClientName}
            label="Client name"
            required
            maxLength={150}
            value={draft.newClientName}
            error={errors.newClientName}
            onChange={(event) =>
              onChange({ newClientName: event.target.value })
            }
          />
          <Input
            id={fieldId.newClientPhone}
            label="Phone"
            required
            inputMode="tel"
            maxLength={16}
            value={draft.newClientPhone}
            error={errors.newClientPhone}
            onChange={(event) =>
              onChange({ newClientPhone: event.target.value })
            }
          />
          <Input
            id={fieldId.newClientEmail}
            type="email"
            label="Email (optional)"
            maxLength={255}
            value={draft.newClientEmail}
            error={errors.newClientEmail}
            onChange={(event) =>
              onChange({ newClientEmail: event.target.value })
            }
          />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          id={fieldId.guestCount}
          type="number"
          min={1}
          step={1}
          label="Guests"
          required
          value={draft.guestCount}
          error={errors.guestCount}
          onChange={(event) => onChange({ guestCount: event.target.value })}
        />
        <Textarea
          id={fieldId.internalNotes}
          label="Internal notes (optional)"
          maxLength={2000}
          rows={3}
          value={draft.internalNotes}
          error={errors.internalNotes}
          onChange={(event) => onChange({ internalNotes: event.target.value })}
        />
      </div>
    </div>
  );
}

function FinancialStep({
  draft,
  errors,
  selectedUnit,
  onChange,
}: StepProps & { selectedUnit?: { basePricePerNight: number } }) {
  return (
    <div className="space-y-5">
      <StepHeading
        eyebrow="Step 4 of 6"
        title="Financial truth"
        description="Enter the exact amount agreed for this historical stay. Current pricing is context only and is never copied or recalculated."
      />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
        <Input
          id={fieldId.agreedAmount}
          label="Agreed amount (EGP)"
          required
          inputMode="decimal"
          placeholder="0.00"
          value={draft.agreedAmount}
          error={errors.agreedAmount}
          helperText="Zero is valid. Up to two decimal places."
          onChange={(event) => onChange({ agreedAmount: event.target.value })}
        />
        <div className="border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            Current unit price · reference only
          </p>
          <p className="mt-1 text-lg font-semibold text-neutral-800">
            {selectedUnit ? safeMoney(selectedUnit.basePricePerNight) : "—"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Not submitted and never used as historical truth.
          </p>
        </div>
      </div>
    </div>
  );
}

function OwnerPolicyStep() {
  return (
    <div className="space-y-5" data-testid="owner-policy-step">
      <StepHeading
        eyebrow="Step 5 of 6"
        title="Owner review"
        description="Review how owner attribution is handled. This step does not look up or predict an owner."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            ShieldCheck,
            "Persisted truth",
            "Historical attribution is established and reviewed from persisted server truth.",
          ],
          [
            CalendarDays,
            "No current-owner inference",
            "Who owns the unit today is not evidence of who should be attributed historically.",
          ],
          [
            UserRoundCheck,
            "Review after creation",
            "After the booking commits, the server review runs with the returned booking ID.",
          ],
        ].map(([Icon, title, body]) => {
          const PolicyIcon = Icon as typeof ShieldCheck;
          return (
            <div
              key={String(title)}
              className="border border-neutral-200 bg-neutral-50 p-4"
            >
              <PolicyIcon aria-hidden className="text-primary-600" size={20} />
              <h3 className="mt-3 text-sm font-semibold text-neutral-900">
                {String(title)}
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                {String(body)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="border-s-4 border-primary-600 bg-primary-50 px-4 py-3 text-sm text-neutral-700">
        Continuing records no acknowledgement and adds no owner field to the
        booking request. No correction occurs automatically.
      </div>
    </div>
  );
}

function ReviewStep({
  draft,
  unitName,
  clientName,
}: {
  draft: HistoricalBookingDraft;
  unitName?: string;
  clientName?: string;
}) {
  return (
    <div className="space-y-5">
      <StepHeading
        eyebrow="Step 6 of 6"
        title="Review and create"
        description="Confirm the exact command. Creation is final once the server returns the booking ID."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.75fr)]">
        <dl className="border-y border-neutral-200">
          <SummaryRow
            label="Provenance"
            value={`${draft.originalSource} · ${draft.historicalEntryReason}`}
          />
          <SummaryRow
            label="Original booking date"
            value={draft.actualBookedAt}
          />
          <SummaryRow
            label="Unit"
            value={unitName ?? compactId(draft.unitId)}
          />
          <SummaryRow
            label="Occupied dates"
            value={`${draft.checkInDate} → ${draft.checkOutDate}`}
          />
          <SummaryRow
            label="Client"
            value={
              draft.clientMode === "existing"
                ? (clientName ?? compactId(draft.clientId))
                : draft.newClientName
            }
          />
          <SummaryRow label="Guests" value={draft.guestCount} />
          <SummaryRow
            label="Agreed amount"
            value={safeMoney(draft.agreedAmount)}
          />
          <SummaryRow
            label="External reference"
            value={draft.externalReference || "None"}
          />
        </dl>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Before you create
          </h3>
          <ul className="mt-3 space-y-3">
            {REQUIRED_WARNINGS.map((warning) => (
              <li
                key={warning}
                className="flex gap-2 text-sm leading-5 text-neutral-600"
              >
                <AlertCircle
                  aria-hidden
                  size={16}
                  className="mt-0.5 shrink-0 text-warning"
                />
                {warning}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ConflictPanel({
  conflict,
  onAcknowledge,
}: {
  conflict: NonNullable<ReturnType<typeof toHistoricalWizardConflict>>;
  onAcknowledge: () => void;
}) {
  const canAcknowledge =
    conflict.candidates.length > 0 || conflict.dateBlocks.length > 0;
  return (
    <section
      aria-label="Booking conflict"
      className="mt-4 border border-warning bg-warning-bg p-4"
    >
      <div className="flex gap-3">
        <AlertCircle
          aria-hidden
          className="mt-0.5 shrink-0 text-warning"
          size={18}
        />
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Server review required
          </h3>
          <p className="mt-1 text-sm text-neutral-700">{conflict.message}</p>
        </div>
      </div>
      {conflict.candidates.length > 0 && (
        <ul className="mt-3 space-y-2">
          {conflict.candidates.map((item) => (
            <li key={item.bookingId} className="text-xs text-neutral-700">
              Booking {compactId(item.bookingId)} · {item.status} ·{" "}
              {item.checkInDate} to {item.checkOutDate}
            </li>
          ))}
        </ul>
      )}
      {conflict.dateBlocks.length > 0 && (
        <ul className="mt-3 space-y-2">
          {conflict.dateBlocks.map((item) => (
            <li key={item.dateBlockId} className="text-xs text-neutral-700">
              Date block {compactId(item.dateBlockId)} · {item.startDate} to{" "}
              {item.endDate}
            </li>
          ))}
        </ul>
      )}
      {canAcknowledge && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onAcknowledge}
        >
          Acknowledge exact IDs
        </Button>
      )}
    </section>
  );
}

function BookingCreatedView({
  state,
  canRecordPayment,
  paymentPending,
  onRetryOwnerReview,
  onUpdatePayment,
  onSubmitPayment,
}: {
  state: ReturnType<typeof createInitialHistoricalWizardState>;
  canRecordPayment: boolean;
  paymentPending: boolean;
  onRetryOwnerReview: () => void;
  onUpdatePayment: (patch: Partial<typeof state.paymentDraft>) => void;
  onSubmitPayment: () => void;
}) {
  const booking = state.booking!;
  return (
    <div
      className="mx-auto max-w-6xl space-y-5"
      data-testid="booking-created-state"
    >
      <header className="border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 aria-hidden size={20} />
          <span className="text-sm font-semibold">
            Historical booking created
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">
          Booking {compactId(booking.id)}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          The booking is committed and remains successful regardless of owner
          review or optional payment outcomes.
        </p>
      </header>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className="space-y-5">
          <section className="border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">
                Committed booking
              </h2>
              <span className="bg-success-bg px-2 py-1 text-xs font-medium text-success">
                Completed · Historical
              </span>
            </div>
            <dl className="mt-3 border-y border-neutral-200">
              <SummaryRow
                label="Booking ID"
                value={<span className="font-mono text-xs">{booking.id}</span>}
              />
              <SummaryRow
                label="Stay"
                value={
                  booking.checkInDate && booking.checkOutDate
                    ? `${booking.checkInDate} → ${booking.checkOutDate}`
                    : "Available in booking details"
                }
              />
              <SummaryRow
                label="Unit"
                value={
                  booking.unitName ??
                  (booking.unitId
                    ? compactId(booking.unitId)
                    : "Available in booking details")
                }
              />
              <SummaryRow
                label="Agreed amount"
                value={
                  booking.recordedAt
                    ? safeMoney(booking.agreedAmount)
                    : "Available in booking details"
                }
              />
              <SummaryRow
                label="Recorded at"
                value={
                  booking.recordedAt
                    ? new Date(booking.recordedAt).toLocaleString("en-EG")
                    : "Recovered after refresh"
                }
              />
            </dl>
            <Link
              href={ROUTES.admin.bookings.detail(booking.id)}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-900"
            >
              Open booking details <ExternalLink aria-hidden size={14} />
            </Link>
          </section>
          <OwnerReviewPanel state={state} onRetry={onRetryOwnerReview} />
        </div>
        <PaymentPanel
          state={state}
          allowed={canRecordPayment}
          pending={paymentPending}
          onChange={onUpdatePayment}
          onSubmit={onSubmitPayment}
        />
      </div>
    </div>
  );
}

function OwnerReviewPanel({
  state,
  onRetry,
}: {
  state: ReturnType<typeof createInitialHistoricalWizardState>;
  onRetry: () => void;
}) {
  return (
    <section
      className="border border-neutral-200 bg-white p-5 shadow-sm"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <UserRoundCheck aria-hidden size={18} className="text-primary-600" />
        <h2 className="text-base font-semibold text-neutral-900">
          Owner attribution review
        </h2>
      </div>
      {state.phase === "BookingCreatedOwnerReviewLoading" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
          <RefreshCw aria-hidden size={15} className="animate-spin" />
          Loading persisted attribution…
        </p>
      )}
      {state.ownerReview && (
        <dl className="mt-3 border-y border-neutral-200">
          <SummaryRow
            label="Persisted owner ID"
            value={
              <span className="font-mono text-xs">
                {state.ownerReview.currentOwnerId}
              </span>
            }
          />
          <SummaryRow
            label="Correction capability"
            value={
              state.ownerReview.canCorrect
                ? "Available in the separate privileged workflow"
                : "Not available"
            }
          />
          <SummaryRow
            label="Payout review"
            value={
              state.ownerReview.payoutReviewRequired
                ? "Required"
                : "No payout review flag"
            }
          />
          <SummaryRow
            label="Warnings"
            value={
              state.ownerReview.warnings.length
                ? state.ownerReview.warnings.join(", ")
                : "None"
            }
          />
        </dl>
      )}
      {state.ownerReviewIssue && (
        <div className="mt-3 border-s-4 border-warning bg-warning-bg px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">
            Booking created
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            {state.ownerReviewIssue.message}
          </p>
          {state.ownerReviewIssue.retryable && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={onRetry}
              leftIcon={<RefreshCw aria-hidden size={14} />}
            >
              Retry owner review
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function PaymentPanel({
  state,
  allowed,
  pending,
  onChange,
  onSubmit,
}: {
  state: ReturnType<typeof createInitialHistoricalWizardState>;
  allowed: boolean;
  pending: boolean;
  onChange: (patch: Partial<typeof state.paymentDraft>) => void;
  onSubmit: () => void;
}) {
  if (!allowed)
    return (
      <section className="border border-neutral-200 bg-white p-5 shadow-sm">
        <Banknote aria-hidden size={20} className="text-neutral-400" />
        <h2 className="mt-3 text-base font-semibold text-neutral-900">
          Optional payment evidence
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          The booking is complete. Historical payment recording is unavailable
          to the current user.
        </p>
      </section>
    );
  if (state.payment) return <PaymentRecorded payment={state.payment} />;
  return (
    <section className="border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Banknote aria-hidden size={18} className="text-primary-600" />
        <h2 className="text-base font-semibold text-neutral-900">
          Optional payment evidence
        </h2>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Record one external historical payment. This does not collect money or
        create an invoice.
      </p>
      {state.paymentError && (
        <div
          role="alert"
          className="mt-4 border-s-4 border-error bg-error-bg px-4 py-3"
        >
          <p className="text-sm font-semibold text-error">
            Booking remains created
          </p>
          <p className="mt-1 text-sm text-neutral-700">{state.paymentError}</p>
        </div>
      )}
      <div className="mt-4 space-y-4">
        <Input
          id="paymentAmount"
          label="Amount (EGP)"
          required
          inputMode="decimal"
          value={state.paymentDraft.amount}
          error={state.validationErrors.paymentAmount}
          onChange={(event) => onChange({ amount: event.target.value })}
        />
        <Select
          id="paymentMethod"
          label="Payment method"
          required
          value={state.paymentDraft.paymentMethod}
          error={state.validationErrors.paymentMethod}
          placeholder="Select method"
          options={[...HISTORICAL_PAYMENT_METHODS]}
          onChange={(value) =>
            onChange({
              paymentMethod: value as typeof state.paymentDraft.paymentMethod,
            })
          }
        />
        <Input
          id="paidAt"
          type="datetime-local"
          label="Paid at"
          required
          value={state.paymentDraft.paidAt}
          error={state.validationErrors.paidAt}
          onChange={(event) => onChange({ paidAt: event.target.value })}
        />
        <Input
          id="referenceNumber"
          label="Reference (optional)"
          maxLength={100}
          value={state.paymentDraft.referenceNumber}
          error={state.validationErrors.referenceNumber}
          onChange={(event) =>
            onChange({ referenceNumber: event.target.value })
          }
        />
        <Textarea
          id="paymentReason"
          label="Recording reason"
          required
          maxLength={500}
          rows={3}
          value={state.paymentDraft.reason}
          error={state.validationErrors.paymentReason}
          onChange={(event) => onChange({ reason: event.target.value })}
        />
        <Button
          type="button"
          fullWidth
          isLoading={pending}
          onClick={onSubmit}
          leftIcon={<FileClock aria-hidden size={16} />}
        >
          Record payment evidence
        </Button>
      </div>
    </section>
  );
}

function PaymentRecorded({ payment }: { payment: HistoricalPaymentResponse }) {
  return (
    <section className="border border-success bg-success-bg p-5">
      <CheckCircle2 aria-hidden size={22} className="text-success" />
      <h2 className="mt-3 text-base font-semibold text-neutral-900">
        Payment evidence recorded
      </h2>
      <p className="mt-1 text-sm text-neutral-700">
        {safeMoney(payment.amount)} · {payment.paymentMethod}
      </p>
      <p className="mt-2 font-mono text-xs text-neutral-600">
        {payment.paymentId}
      </p>
      <p className="mt-3 flex gap-2 text-xs text-neutral-600">
        <Info aria-hidden size={14} />
        Standalone evidence; no invoice or payout was created.
      </p>
    </section>
  );
}
