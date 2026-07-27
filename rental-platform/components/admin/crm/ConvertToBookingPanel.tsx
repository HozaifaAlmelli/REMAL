"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Loader2 } from "lucide-react";
import { useConvertToBooking } from "@/lib/hooks/useCrm";
import { useCreateClient } from "@/lib/hooks/useClients";
import { useAvailabilityCheck } from "@/lib/hooks/usePublic";
import {
  useInternalUnitDetail,
  useInternalUnitsList,
} from "@/lib/hooks/useUnits";
import { clientsService } from "@/lib/api/services/clients.service";
import { ApiError } from "@/lib/api/api-error";
import { toastSuccess } from "@/lib/utils/toast";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  CRM_CLOSED_STATUSES,
  CRM_STATUS_LABELS,
} from "@/lib/constants/booking-statuses";
import {
  isUnitAvailabilityConflict,
} from "@/lib/constants/crm-recommendation";
import { Button } from "@/components/ui/Button";
import type { CrmLeadDetailsResponse } from "@/lib/types/crm.types";
import type { UnitListItemResponse } from "@/lib/types/unit.types";
import {
  buildCrmBookingWizardSteps,
  CRM_BOOKING_WIZARD_COPY,
  isValidStayRange,
  requiresStayDetailsStep,
  type CrmBookingWizardStepId,
} from "./booking-wizard/crm-booking-wizard";
import {
  useCrmBookingWizard,
  useCrmBookingWizardLocale,
  type WizardClientSummary,
} from "./booking-wizard/useCrmBookingWizard";
import { CrmBookingWizardStepper } from "./booking-wizard/CrmBookingWizardStepper";
import { CrmBookingWizardSummary } from "./booking-wizard/CrmBookingWizardSummary";
import {
  BookingDetailsStep,
  ClientStep,
  type ClientValidationErrors,
  ReviewStep,
  StayStep,
  TemporaryPasswordNotice,
  UnitStep,
} from "./booking-wizard/CrmBookingWizardSteps";

interface ConvertToBookingPanelProps {
  leadId: string;
  lead: CrmLeadDetailsResponse;
}

const PHONE_PATTERN = /^\+?\d{10,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return error.errors[0] ?? error.message ?? fallback;
}

export function ConvertToBookingPanel({
  leadId,
  lead,
}: ConvertToBookingPanelProps) {
  const { canManageCRM } = usePermissions();
  const convertMutation = useConvertToBooking(leadId);
  const createClientMutation = useCreateClient();
  const locale = useCrmBookingWizardLocale();
  const copy = CRM_BOOKING_WIZARD_COPY[locale];
  const { state, dispatch } = useCrmBookingWizard(lead);
  const [clientValidationErrors, setClientValidationErrors] =
    useState<ClientValidationErrors>({});
  const [passwordCopied, setPasswordCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const requiresStayStep = requiresStayDetailsStep(lead);
  const requiresUnitStep =
    lead.needsRecommendation && !lead.targetUnitId;
  const requiresClientStep = !lead.clientId;
  const hasValidStay = isValidStayRange(
    state.checkInDate,
    state.checkOutDate
  );

  const {
    data: unitsData,
    isLoading: isLoadingUnits,
    isFetching: isFetchingUnits,
    isError: isUnitsError,
    refetch: refetchUnits,
  } = useInternalUnitsList(
    {
      pageSize: 500,
      isActive: true,
      availableFrom: state.checkInDate || undefined,
      availableTo: state.checkOutDate || undefined,
      unitType: state.unitTypeFilter || undefined,
    },
    { enabled: requiresUnitStep && hasValidStay }
  );
  const {
    data: linkedUnit,
    isLoading: isLoadingLinkedUnit,
    isError: isLinkedUnitError,
    refetch: refetchLinkedUnit,
  } = useInternalUnitDetail(lead.targetUnitId ?? "");

  const availableUnits = useMemo(
    () => unitsData?.items ?? [],
    [unitsData?.items]
  );
  const selectedUnit = useMemo<UnitListItemResponse | null>(() => {
    const fromResults = availableUnits.find(
      (unit) => unit.id === state.selectedUnitId
    );
    if (fromResults) return fromResults;
    if (linkedUnit?.id === state.selectedUnitId) return linkedUnit;
    return null;
  }, [availableUnits, linkedUnit, state.selectedUnitId]);

  const isRefreshingUnits = isLoadingUnits || isFetchingUnits;
  const hasGuestCapacityConflict = Boolean(
    selectedUnit && state.guestCount > selectedUnit.maxGuests
  );
  const guestError =
    state.guestCount < 1
      ? copy.guestMinimum
      : hasGuestCapacityConflict && selectedUnit
        ? copy.capacity(selectedUnit.name, selectedUnit.maxGuests)
        : null;

  const { data: availability, isLoading: isCheckingAvailability } =
    useAvailabilityCheck(
      state.selectedUnitId ?? "",
      state.checkInDate || null,
      state.checkOutDate || null
    );
  const hasDateConflict = availability?.isAvailable === false;

  const domainState = useMemo(
    () => ({
      checkInDate: state.checkInDate,
      checkOutDate: state.checkOutDate,
      selectedUnitId: state.selectedUnitId,
      clientId: state.clientId,
      guestCount: state.guestCount,
      hasGuestCapacityConflict,
    }),
    [
      hasGuestCapacityConflict,
      state.checkInDate,
      state.checkOutDate,
      state.clientId,
      state.guestCount,
      state.selectedUnitId,
    ]
  );
  const steps = useMemo(
    () =>
      buildCrmBookingWizardSteps({
        locale,
        currentStep: state.currentStep,
        state: domainState,
        requiresStayStep,
        requiresUnitStep,
        requiresClientStep,
      }),
    [
      domainState,
      locale,
      requiresClientStep,
      requiresStayStep,
      requiresUnitStep,
      state.currentStep,
    ]
  );
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === state.currentStep)
  );
  const previousStep = steps[currentIndex - 1];
  const nextStep = steps[currentIndex + 1];

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [state.currentStep]);

  useEffect(() => {
    if (
      !requiresUnitStep ||
      !state.selectedUnitId ||
      isRefreshingUnits ||
      isUnitsError
    ) {
      return;
    }

    if (!availableUnits.some((unit) => unit.id === state.selectedUnitId)) {
      dispatch({
        type: "availabilityConflict",
        message: copy.conflict,
      });
    }
  }, [
    availableUnits,
    copy.conflict,
    dispatch,
    isRefreshingUnits,
    isUnitsError,
    requiresUnitStep,
    state.selectedUnitId,
  ]);

  useEffect(() => {
    if (
      !state.selectedUnitId ||
      isCheckingAvailability ||
      !hasDateConflict
    ) {
      return;
    }

    dispatch({
      type: "availabilityConflict",
      message: copy.conflict,
    });
  }, [
    copy.conflict,
    dispatch,
    hasDateConflict,
    isCheckingAvailability,
    state.selectedUnitId,
  ]);

  const goToStep = (stepId: CrmBookingWizardStepId) => {
    const target = steps.find((step) => step.id === stepId);
    if (!target || target.isBlocked) return;
    dispatch({ type: "goTo", step: stepId });
  };

  const goForward = () => {
    if (nextStep) dispatch({ type: "goTo", step: nextStep.id });
  };

  const validateClientDraft = (): boolean => {
    const errors: ClientValidationErrors = {};
    const name = state.clientDraft.name.trim();
    const phone = state.clientDraft.phone.trim();
    const email = state.clientDraft.email.trim();

    if (!name) errors.name = copy.clientRequired;
    if (!PHONE_PATTERN.test(phone)) errors.phone = copy.phoneInvalid;
    if (email && !EMAIL_PATTERN.test(email)) errors.email = copy.emailInvalid;

    setClientValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const findExistingClient = async (phone: string, email?: string) => {
    const normalizedPhone = phone.replace(/\+/g, "");
    const byPhone = await clientsService.getAll({
      search: normalizedPhone,
      includeInactive: true,
      pageSize: 20,
    });
    const phoneMatch = byPhone.items.find(
      (client) => client.phone.replace(/\+/g, "") === normalizedPhone
    );
    if (phoneMatch) return phoneMatch;

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return null;
    const byEmail = await clientsService.getAll({
      search: normalizedEmail,
      includeInactive: true,
      pageSize: 20,
    });
    return (
      byEmail.items.find(
        (client) => client.email?.toLowerCase() === normalizedEmail
      ) ?? null
    );
  };

  const attachClientAndAdvance = (
    client: WizardClientSummary,
    temporaryPassword?: string | null
  ) => {
    dispatch({ type: "attachClient", client, temporaryPassword });
    if (nextStep) dispatch({ type: "goTo", step: nextStep.id });
  };

  const handleClientSubmit = async () => {
    if (state.client) {
      goForward();
      return;
    }
    if (!validateClientDraft()) return;

    dispatch({ type: "setClientError", message: null });
    const name = state.clientDraft.name.trim();
    const phone = state.clientDraft.phone.trim();
    const email = state.clientDraft.email.trim() || undefined;

    try {
      const existing = await findExistingClient(phone, email);
      if (existing) {
        attachClientAndAdvance({
          id: existing.id,
          name: existing.name,
          phone: existing.phone,
          email: existing.email,
        });
        toastSuccess(copy.matchedExisting);
        return;
      }
    } catch {
      // A transient lookup failure must not block the existing create flow.
      // The create endpoint still enforces phone/email uniqueness.
    }

    createClientMutation.mutate(
      { name, phone, email },
      {
        onSuccess: (client) => {
          attachClientAndAdvance(
            {
              id: client.id,
              name: client.name,
              phone: client.phone,
              email: client.email,
            },
            client.temporaryPassword
          );
        },
        onError: async (error) => {
          if (error instanceof ApiError && error.status === 409) {
            try {
              const existing = await findExistingClient(phone, email);
              if (existing) {
                attachClientAndAdvance({
                  id: existing.id,
                  name: existing.name,
                  phone: existing.phone,
                  email: existing.email,
                });
                return;
              }
            } catch {
              // Fall through to the inline error below.
            }
          }

          dispatch({
            type: "setClientError",
            message: errorMessage(error, copy.clientLookupError),
          });
        },
      }
    );
  };

  const handleConvert = () => {
    if (
      !state.clientId ||
      !state.selectedUnitId ||
      !selectedUnit ||
      !hasValidStay ||
      state.guestCount < 1 ||
      hasGuestCapacityConflict ||
      convertMutation.isPending
    ) {
      return;
    }

    dispatch({ type: "setSubmissionError", message: null });
    convertMutation.mutate(
      {
        clientId: state.clientId,
        unitId: state.selectedUnitId,
        checkInDate: state.checkInDate,
        checkOutDate: state.checkOutDate,
        guestCount: state.guestCount,
        internalNotes: state.internalNotes.trim() || undefined,
      },
      {
        onError: (error) => {
          if (
            error instanceof ApiError &&
            error.status === 409 &&
            isUnitAvailabilityConflict(error, state.selectedUnitId!)
          ) {
            dispatch({
              type: "availabilityConflict",
              message: copy.conflict,
            });
            void refetchUnits();
            return;
          }

          dispatch({
            type: "setSubmissionError",
            message: errorMessage(error, copy.bookingError),
          });
        },
      }
    );
  };

  const handlePrimaryAction = () => {
    switch (state.currentStep) {
      case "stay":
        if (hasValidStay) goForward();
        return;
      case "unit":
        if (
          state.selectedUnitId &&
          selectedUnit &&
          !hasDateConflict &&
          !isCheckingAvailability
        ) {
          goForward();
        }
        return;
      case "client":
        void handleClientSubmit();
        return;
      case "booking":
        if (!guestError) goForward();
        return;
      case "review":
        handleConvert();
    }
  };

  if (CRM_CLOSED_STATUSES.includes(lead.leadStatus)) return null;

  if (lead.leadStatus !== "Booked") {
    return (
      <div className="grid gap-3 rounded-[var(--portal-radius-card)] border border-warning-bg bg-warning-bg p-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
        <h3 className="text-sm font-semibold text-warning">
          Convert to booking
        </h3>
        <div className="space-y-1">
          <p className="text-sm text-warning">
            This lead must be moved to <strong>Booked</strong> status before it
            can be converted to a booking.
          </p>
          <p className="text-xs text-warning">
            Current status:{" "}
            <strong>
              {CRM_STATUS_LABELS[lead.leadStatus] ?? lead.leadStatus}
            </strong>
          </p>
        </div>
      </div>
    );
  }

  if (!lead.targetUnitId && !lead.needsRecommendation) {
    return (
      <div className="grid gap-3 rounded-[var(--portal-radius-card)] border border-warning-bg bg-warning-bg p-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
        <h3 className="text-sm font-semibold text-warning">
          Convert to booking
        </h3>
        <p className="text-sm text-warning">
          Add a target unit to this lead before converting. Historical
          unit-less leads are not treated as recommendation requests.
        </p>
      </div>
    );
  }

  const checkInLocked = Boolean(lead.desiredCheckInDate);
  const checkOutLocked = Boolean(lead.desiredCheckOutDate);
  const lockedInvalid =
    checkInLocked &&
    checkOutLocked &&
    !isValidStayRange(
      lead.desiredCheckInDate!,
      lead.desiredCheckOutDate!
    );
  const dateError =
    state.checkInDate &&
    state.checkOutDate &&
    !isValidStayRange(state.checkInDate, state.checkOutDate)
      ? copy.stayDateError
      : null;
  const unitDetailUnavailable =
    Boolean(lead.targetUnitId) && isLinkedUnitError;
  const primaryDisabled =
    !canManageCRM ||
    (state.currentStep === "stay" &&
      (!hasValidStay || lockedInvalid)) ||
    (state.currentStep === "unit" &&
      (!state.selectedUnitId ||
        !selectedUnit ||
        isRefreshingUnits ||
        isCheckingAvailability ||
        hasDateConflict)) ||
    (state.currentStep === "client" &&
      createClientMutation.isPending) ||
    (state.currentStep === "booking" && Boolean(guestError)) ||
    (state.currentStep === "review" &&
      (!selectedUnit ||
        unitDetailUnavailable ||
        convertMutation.isPending ||
        isCheckingAvailability));

  const primaryLabel =
    state.currentStep === "review"
      ? copy.createBooking
      : state.currentStep === "client" && !state.client
        ? copy.createOrAttach
        : copy.continue;

  return (
    <section
      dir={copy.direction}
      aria-labelledby="crm-booking-wizard-title"
      className="overflow-clip rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white"
    >
      <header className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <h2
          id="crm-booking-wizard-title"
          className="text-base font-semibold text-neutral-900"
        >
          {copy.title}
        </h2>
        <p className="mt-1 max-w-[70ch] text-sm text-neutral-600">
          {copy.description}
        </p>
      </header>

      <div
        className="border-b border-neutral-200 px-4 py-3 sm:px-5"
        style={
          { "--wizard-steps": steps.length } as CSSProperties
        }
      >
        <CrmBookingWizardStepper
          steps={steps}
          currentStep={state.currentStep}
          copy={copy}
          onStepChange={goToStep}
        />
      </div>

      <div className="px-4 py-4 sm:px-5 lg:hidden">
        <CrmBookingWizardSummary
          compact
          state={state}
          selectedUnit={selectedUnit}
          copy={copy}
          onEdit={goToStep}
          canEditStay={requiresStayStep}
          canEditUnit={requiresUnitStep}
          canEditClient={requiresClientStep}
        />
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div
          aria-labelledby="crm-booking-step-heading"
          className="min-h-[22rem] min-w-0 px-4 pb-6 pt-3 sm:px-5 sm:pt-5 lg:px-6 lg:py-6"
        >
          {state.temporaryPassword && state.currentStep !== "client" && (
            <TemporaryPasswordNotice
              password={state.temporaryPassword}
              copy={copy}
              copied={passwordCopied}
              onCopy={async () => {
                await navigator.clipboard.writeText(state.temporaryPassword!);
                setPasswordCopied(true);
              }}
            />
          )}

          <div className={state.temporaryPassword ? "mt-5" : undefined}>
            {state.currentStep === "stay" && (
              <StayStep
                state={state}
                copy={copy}
                headingRef={headingRef}
                checkInLocked={checkInLocked}
                checkOutLocked={checkOutLocked}
                lockedInvalid={lockedInvalid}
                dateError={dateError}
                onChange={(checkInDate, checkOutDate) =>
                  dispatch({
                    type: "setStay",
                    checkInDate,
                    checkOutDate,
                    clearSelectedUnit: requiresUnitStep,
                  })
                }
              />
            )}

            {state.currentStep === "unit" && (
              <UnitStep
                state={state}
                copy={copy}
                headingRef={headingRef}
                units={availableUnits}
                isRefreshing={isRefreshingUnits}
                isError={isUnitsError}
                onRetry={() => void refetchUnits()}
                onSelect={(unitId) =>
                  dispatch({ type: "selectUnit", unitId })
                }
                onUnitTypeChange={(unitType) =>
                  dispatch({ type: "setUnitType", unitType })
                }
                disabled={convertMutation.isPending}
              />
            )}

            {state.currentStep === "client" && (
              <ClientStep
                state={state}
                copy={copy}
                headingRef={headingRef}
                validationErrors={clientValidationErrors}
                isLoading={createClientMutation.isPending}
                onDraftChange={(draft) => {
                  setClientValidationErrors({});
                  dispatch({ type: "setClientDraft", draft });
                }}
                onSubmit={() => void handleClientSubmit()}
                onChangeClient={() => {
                  dispatch({ type: "clearClient", lead });
                  setClientValidationErrors({});
                }}
              />
            )}

            {state.currentStep === "booking" && (
              <BookingDetailsStep
                state={state}
                copy={copy}
                headingRef={headingRef}
                selectedUnit={selectedUnit}
                isLoading={convertMutation.isPending}
                guestError={guestError}
                onGuestCountChange={(guestCount) =>
                  dispatch({ type: "setGuestCount", guestCount })
                }
                onNotesChange={(internalNotes) =>
                  dispatch({ type: "setInternalNotes", internalNotes })
                }
              />
            )}

            {state.currentStep === "review" &&
              (isLoadingLinkedUnit && !selectedUnit ? (
                <div
                  role="status"
                  className="flex min-h-48 items-center justify-center gap-2 text-sm text-neutral-500"
                >
                  <Loader2
                    aria-hidden="true"
                    size={17}
                    className="animate-spin"
                  />
                  {copy.loadingUnits}
                </div>
              ) : unitDetailUnavailable || !selectedUnit ? (
                <div
                  role="alert"
                  className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-error"
                >
                  <CircleAlert aria-hidden="true" size={20} />
                  <p>{copy.unitLoadError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refetchLinkedUnit()}
                  >
                    {copy.retry}
                  </Button>
                </div>
              ) : (
                <ReviewStep
                  state={state}
                  copy={copy}
                  headingRef={headingRef}
                  selectedUnit={selectedUnit}
                  onEdit={goToStep}
                  canEditStay={requiresStayStep}
                  canEditUnit={requiresUnitStep}
                  canEditClient={requiresClientStep}
                />
              ))}
          </div>
        </div>

        <div className="hidden border-s border-neutral-200 bg-neutral-50/70 p-4 lg:block">
          <CrmBookingWizardSummary
            className="sticky top-4 border-0 bg-transparent p-0"
            state={state}
            selectedUnit={selectedUnit}
            copy={copy}
            onEdit={goToStep}
            canEditStay={requiresStayStep}
            canEditUnit={requiresUnitStep}
            canEditClient={requiresClientStep}
          />
        </div>
      </div>

      {canManageCRM && (
        <footer className="sticky bottom-0 z-[var(--z-sticky)] flex items-center justify-between gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-5">
          <div>
            {previousStep && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  dispatch({ type: "goTo", step: previousStep.id })
                }
                disabled={
                  convertMutation.isPending ||
                  createClientMutation.isPending
                }
                leftIcon={
                  <ChevronLeft
                    aria-hidden="true"
                    size={16}
                    className="rtl:rotate-180"
                  />
                }
              >
                {copy.back}
              </Button>
            )}
          </div>
          <Button
            type="button"
            onClick={handlePrimaryAction}
            isLoading={
              convertMutation.isPending ||
              createClientMutation.isPending
            }
            disabled={primaryDisabled}
            rightIcon={
              state.currentStep === "review" ? undefined : (
                <ChevronRight
                  aria-hidden="true"
                  size={16}
                  className="rtl:rotate-180"
                />
              )
            }
          >
            {primaryLabel}
          </Button>
        </footer>
      )}
    </section>
  );
}
