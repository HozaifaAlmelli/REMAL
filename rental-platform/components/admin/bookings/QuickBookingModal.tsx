"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { AvailableUnitPicker } from "@/components/admin/crm/AvailableUnitPicker";
import { useClients } from "@/lib/hooks/useClients";
import { useInternalUnitsList } from "@/lib/hooks/useUnits";
import { useAvailabilityCheck } from "@/lib/hooks/usePublic";
import { useCreateQuickBooking } from "@/lib/hooks/useBookings";
import { formatDateForApi } from "@/lib/utils/format";
import { AlertTriangle } from "lucide-react";
import type { CreateBookingRequest } from "@/lib/types/booking.types";
import type { UnitType } from "@/lib/types/unit.types";

interface QuickBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOURCE_OPTIONS: Array<{
  value: CreateBookingRequest["source"];
  label: string;
}> = [
  { value: "admin", label: "Admin" },
  { value: "direct", label: "Direct" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
];

type QuickBookingDetails = {
  clientId: string;
  unitId: string;
  guestCount: number;
  source: CreateBookingRequest["source"];
  internalNotes: string;
};

const INITIAL_DETAILS: QuickBookingDetails = {
  clientId: "",
  unitId: "",
  guestCount: 1,
  source: "admin",
  internalNotes: "",
};

export function QuickBookingModal({ isOpen, onClose }: QuickBookingModalProps) {
  const createMutation = useCreateQuickBooking();

  const [dateRange, setDateRange] = React.useState<{
    from: Date | null;
    to: Date | null;
  }>({ from: null, to: null });
  const [unitTypeFilter, setUnitTypeFilter] = React.useState<"" | UnitType>("");
  const [details, setDetails] = React.useState<QuickBookingDetails>(INITIAL_DETAILS);

  React.useEffect(() => {
    if (!isOpen) {
      setDateRange({ from: null, to: null });
      setUnitTypeFilter("");
      setDetails(INITIAL_DETAILS);
    }
  }, [isOpen]);

  const checkInDate = dateRange.from ? formatDateForApi(dateRange.from) : null;
  const checkOutDate = dateRange.to ? formatDateForApi(dateRange.to) : null;
  const nights =
    checkInDate && checkOutDate
      ? Math.round(
          (new Date(checkOutDate).getTime() -
            new Date(checkInDate).getTime()) /
            86_400_000
        )
      : 0;
  const hasValidRange = Boolean(checkInDate && checkOutDate && nights >= 1);
  const hasInvalidCompleteRange = Boolean(
    checkInDate && checkOutDate && nights < 1
  );

  const { data: clientsData, isLoading: clientsLoading } = useClients({
    includeInactive: false,
    pageSize: 500,
  });

  // Units already filtered to those AVAILABLE for the chosen dates (and type).
  const {
    data: unitsData,
    isLoading: isLoadingUnits,
    isFetching: isFetchingUnits,
  } = useInternalUnitsList(
    {
      pageSize: 500,
      isActive: true,
      availableFrom: checkInDate ?? undefined,
      availableTo: checkOutDate ?? undefined,
      unitType: unitTypeFilter || undefined,
    },
    { enabled: hasValidRange }
  );
  const isRefreshingUnits = isLoadingUnits || isFetchingUnits;

  // Belt-and-suspenders: re-confirm the picked unit is free for the exact dates.
  const { data: availability, isLoading: isCheckingAvailability } =
    useAvailabilityCheck(details.unitId || "", checkInDate, checkOutDate);
  const hasDateConflict = availability?.isAvailable === false;

  const selectedUnit = (unitsData?.items ?? []).find(
    (unit) => unit.id === details.unitId
  );
  const hasGuestCapacityConflict = Boolean(
    selectedUnit && details.guestCount > selectedUnit.maxGuests
  );
  const unitCapacityText = selectedUnit
    ? `${selectedUnit.name} accepts up to ${selectedUnit.maxGuests} ${
        selectedUnit.maxGuests === 1 ? "guest" : "guests"
      }.`
    : undefined;
  const guestCapacityError = hasGuestCapacityConflict
    ? `${unitCapacityText} Reduce the guest count or choose another unit.`
    : undefined;

  // Drop the selected unit when the date range becomes invalid, or when the unit
  // is no longer in the available list for the (possibly changed) dates/type.
  React.useEffect(() => {
    if (!details.unitId) return;

    if (!hasValidRange) {
      setDetails((current) => ({ ...current, unitId: "" }));
      return;
    }

    if (
      !isRefreshingUnits &&
      !(unitsData?.items ?? []).some((unit) => unit.id === details.unitId)
    ) {
      setDetails((current) => ({ ...current, unitId: "" }));
    }
  }, [hasValidRange, isRefreshingUnits, details.unitId, unitsData?.items]);

  const clientOptions = React.useMemo(
    () =>
      (clientsData?.items ?? []).map((client) => ({
        value: client.id,
        label: `${client.name} - ${client.phone}`,
      })),
    [clientsData?.items]
  );

  const canSubmit =
    Boolean(details.clientId) &&
    Boolean(details.unitId) &&
    hasValidRange &&
    details.guestCount > 0 &&
    !hasDateConflict &&
    !hasGuestCapacityConflict &&
    !isRefreshingUnits &&
    !createMutation.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !checkInDate || !checkOutDate) return;

    createMutation.mutate(
      {
        clientId: details.clientId,
        unitId: details.unitId,
        checkInDate,
        checkOutDate,
        guestCount: details.guestCount,
        source: details.source,
        internalNotes: details.internalNotes?.trim() || undefined,
      },
      {
        onSuccess: onClose,
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Booking" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <DateRangePicker
          label="Stay dates"
          value={dateRange}
          onChange={(range) => setDateRange(range)}
          placeholder="Select check-in and check-out"
        />

        {hasInvalidCompleteRange && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-medium">
              Check-out date must be at least 1 night after check-in.
            </p>
          </div>
        )}

        <div className="w-full">
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Available unit
          </label>
          <AvailableUnitPicker
            units={unitsData?.items ?? []}
            value={details.unitId || null}
            onChange={(id) =>
              setDetails((current) => ({ ...current, unitId: id || "" }))
            }
            unitTypeFilter={unitTypeFilter}
            onUnitTypeFilterChange={(type) => {
              setUnitTypeFilter(type);
              setDetails((current) => ({ ...current, unitId: "" }));
            }}
            hasValidRange={hasValidRange}
            isRefreshing={isRefreshingUnits}
            disabled={createMutation.isPending}
          />
        </div>

        {hasDateConflict && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Selected dates are unavailable.</p>
              <p className="mt-0.5">
                {availability?.reason || "BookingConflict"}
                {availability?.blockedDates?.length
                  ? `: ${availability.blockedDates.join(", ")}`
                  : ""}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Client
            </label>
            <Combobox
              options={clientOptions}
              value={details.clientId || null}
              onChange={(value) =>
                setDetails((current) => ({
                  ...current,
                  clientId: value ? String(value) : "",
                }))
              }
              placeholder={
                clientsLoading ? "Loading clients..." : "Select client"
              }
              disabled={clientsLoading || createMutation.isPending}
              searchable
            />
          </div>

          <Input
            label="Guests"
            type="number"
            min={1}
            max={selectedUnit?.maxGuests}
            value={details.guestCount}
            onChange={(event) =>
              setDetails((current) => ({
                ...current,
                guestCount: Number(event.target.value),
              }))
            }
            error={guestCapacityError}
            helperText={
              unitCapacityText ?? "Select a unit to see its guest capacity."
            }
            disabled={createMutation.isPending}
            required
          />
        </div>

        <Select
          label="Source"
          value={details.source}
          options={SOURCE_OPTIONS}
          onChange={(value) =>
            setDetails((current) => ({
              ...current,
              source: String(value) as CreateBookingRequest["source"],
            }))
          }
          disabled={createMutation.isPending}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Internal notes
          </label>
          <textarea
            value={details.internalNotes}
            onChange={(event) =>
              setDetails((current) => ({
                ...current,
                internalNotes: event.target.value,
              }))
            }
            className="h-24 w-full resize-none rounded-[var(--portal-radius-control)] border border-neutral-300 p-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={createMutation.isPending}
          />
        </div>

        <Modal.Footer>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={createMutation.isPending || isCheckingAvailability}
            disabled={!canSubmit}
          >
            Create booking
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
