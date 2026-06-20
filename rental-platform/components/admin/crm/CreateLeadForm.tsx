"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Combobox } from "@/components/ui/Combobox";
import { BOOKING_SOURCE_LABELS } from "@/lib/constants/booking-sources";
import { useInternalUnitsList } from "@/lib/hooks/useUnits";
import { useAvailabilityCheck } from "@/lib/hooks/usePublic";
import { formatDateForApi, sanitizePhoneInput } from "@/lib/utils/format";
import { AlertTriangle } from "lucide-react";
import type { CreateCrmLeadRequest } from "@/lib/types/crm.types";

const BOOKING_SOURCE_OPTIONS = Object.entries(BOOKING_SOURCE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  })
);

const createLeadSchema = z.object({
  contactName: z.string().min(1, "Please enter the contact name"),
  contactPhone: z
    .string()
    .min(1, "Please enter the phone number")
    .regex(
      /^\+?\d{10,15}$/,
      "Invalid phone configuration. Provide 10-15 digits with an optional leading '+' format."
    ),
  contactEmail: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  targetUnitId: z.string().optional(),
  desiredCheckInDate: z.date().optional(),
  desiredCheckOutDate: z.date().optional(),
  guestCount: z
    .number({ invalid_type_error: "Please enter the guest count" })
    .int("Guest count must be a whole number")
    .min(1, "Guest count must be at least 1"),
  source: z.enum(["website", "direct", "whatsapp", "phone", "admin"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof createLeadSchema>;

interface CreateLeadFormProps {
  onSubmit: (data: CreateCrmLeadRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function CreateLeadForm({
  onSubmit,
  onCancel,
  isLoading,
}: CreateLeadFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createLeadSchema),
    mode: "onChange",
    defaultValues: {
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      source: "phone",
      targetUnitId: undefined,
      guestCount: undefined,
      notes: "",
    },
  });

  const targetUnitId = watch("targetUnitId");
  const guestCount = watch("guestCount");
  const desiredCheckInDate = watch("desiredCheckInDate");
  const desiredCheckOutDate = watch("desiredCheckOutDate");
  const desiredStart = desiredCheckInDate
    ? formatDateForApi(desiredCheckInDate)
    : null;
  const desiredEnd = desiredCheckOutDate
    ? formatDateForApi(desiredCheckOutDate)
    : null;
  const nights =
    desiredStart && desiredEnd
      ? Math.round(
          (new Date(desiredEnd).getTime() -
            new Date(desiredStart).getTime()) /
            86_400_000
        )
      : 0;
  const hasValidRange = Boolean(desiredStart && desiredEnd && nights >= 1);
  const hasInvalidCompleteRange = Boolean(
    desiredStart && desiredEnd && nights < 1
  );
  const { data: unitsData, isLoading: isLoadingUnits } =
    useInternalUnitsList(
      {
        pageSize: 500,
        availableFrom: desiredStart ?? undefined,
        availableTo: desiredEnd ?? undefined,
      },
      { enabled: hasValidRange }
    );
  const { data: availability, isLoading: isCheckingAvailability } =
    useAvailabilityCheck(targetUnitId || "", desiredStart, desiredEnd);
  const hasDateConflict = availability?.isAvailable === false;
  const unitOptions = (unitsData?.items ?? []).map((u) => ({
    value: u.id,
    label: u.name,
  }));
  const selectedUnit = (unitsData?.items ?? []).find(
    (unit) => unit.id === targetUnitId
  );
  const hasGuestCapacityConflict = Boolean(
    selectedUnit && guestCount && guestCount > selectedUnit.maxGuests
  );
  const unitCapacityText = selectedUnit
    ? `${selectedUnit.name} accepts up to ${selectedUnit.maxGuests} ${
        selectedUnit.maxGuests === 1 ? "guest" : "guests"
      }.`
    : undefined;
  const guestCapacityError = hasGuestCapacityConflict
    ? `${unitCapacityText} Reduce the guest count or choose another unit.`
    : undefined;
  const phoneReg = register("contactPhone");

  useEffect(() => {
    if (!targetUnitId) return;

    if (!hasValidRange) {
      setValue("targetUnitId", undefined);
      return;
    }

    if (
      !isLoadingUnits &&
      !(unitsData?.items ?? []).some((unit) => unit.id === targetUnitId)
    ) {
      setValue("targetUnitId", undefined);
    }
  }, [
    hasValidRange,
    isLoadingUnits,
    setValue,
    targetUnitId,
    unitsData?.items,
  ]);

  const handleFormSubmit = (values: FormValues) => {
    // Only parse valid numbers
    const payload: CreateCrmLeadRequest = {
      contactName: values.contactName.trim(),
      contactPhone: values.contactPhone.trim(),
      contactEmail: values.contactEmail?.trim() || undefined,
      targetUnitId: values.targetUnitId || undefined,
      desiredCheckInDate: values.desiredCheckInDate
        ? formatDateForApi(values.desiredCheckInDate)
        : undefined,
      desiredCheckOutDate: values.desiredCheckOutDate
        ? formatDateForApi(values.desiredCheckOutDate)
        : undefined,
      guestCount: values.guestCount,
      source: values.source,
      notes: values.notes?.trim() || undefined,
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <DateRangePicker
        label="Desired dates"
        value={{
          from: desiredCheckInDate || null,
          to: desiredCheckOutDate || null,
        }}
        onChange={(range) => {
          setValue("desiredCheckInDate", range.from || undefined);
          setValue("desiredCheckOutDate", range.to || undefined);
        }}
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
          Target unit
        </label>
        <Controller
          name="targetUnitId"
          control={control}
          render={({ field }) => (
            <Combobox
              options={unitOptions}
              value={field.value || null}
              onChange={(val) => field.onChange(val || undefined)}
              placeholder={
                !hasValidRange
                  ? "Select desired date range to view available units"
                  : isLoadingUnits
                    ? "Loading available units…"
                    : "Search available units"
              }
              disabled={
                isLoading ||
                !hasValidRange ||
                isLoadingUnits ||
                unitOptions.length === 0
              }
            />
          )}
        />
        {hasValidRange && !isLoadingUnits && unitOptions.length === 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            No units available for this date frame. Try adjusting your dates.
          </p>
        )}
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

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Contact name"
          {...register("contactName")}
          error={errors.contactName?.message}
          required
          disabled={isLoading}
        />
        <Input
          label="Phone number"
          type="tel"
          {...phoneReg}
          onChange={(event) => {
            event.target.value = sanitizePhoneInput(event.target.value);
            phoneReg.onChange(event);
          }}
          error={errors.contactPhone?.message}
          required
          disabled={isLoading}
        />
      </div>

      <Input
        label="Email (optional)"
        type="email"
        {...register("contactEmail")}
        error={errors.contactEmail?.message}
        disabled={isLoading}
      />

      <div className="grid grid-cols-2 gap-4">
        <Controller
          name="source"
          control={control}
          render={({ field }) => (
            <Select
              label="Source"
              options={BOOKING_SOURCE_OPTIONS}
              value={field.value}
              onChange={(val) => field.onChange(val)}
              error={errors.source?.message}
              required
              disabled={isLoading}
            />
          )}
        />
        <Controller
          name="guestCount"
          control={control}
          render={({ field }) => (
            <Input
              label="Guest count"
              type="number"
              inputMode="numeric"
              min={1}
              max={selectedUnit?.maxGuests}
              step={1}
              required
              name={field.name}
              ref={field.ref}
              value={field.value ?? ""}
              onBlur={field.onBlur}
              onKeyDown={(event) => {
                if (["-", "+", "e", "E", "."].includes(event.key)) {
                  event.preventDefault();
                }
              }}
              onChange={(event) => {
                if (event.target.value === "") {
                  field.onChange(undefined);
                  return;
                }

                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed)) return;

                field.onChange(Math.max(1, Math.trunc(parsed)));
              }}
              error={errors.guestCount?.message ?? guestCapacityError}
              helperText={
                unitCapacityText ?? "Select a unit to see its guest capacity."
              }
              disabled={isLoading}
            />
          )}
        />
      </div>

      <div className="w-full">
        <label className="mb-1.5 block text-sm font-medium text-neutral-700">
          Internal note (optional)
        </label>
        <textarea
          {...register("notes")}
          placeholder="Add source details, client preferences, or follow-up context"
          className="h-24 w-full resize-none rounded-lg border border-neutral-300 p-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
          disabled={isLoading}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          variant="ghost"
          type="button"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isLoading || isCheckingAvailability}
          disabled={
            hasDateConflict ||
            !hasValidRange ||
            !targetUnitId ||
            !guestCount ||
            hasGuestCapacityConflict ||
            isLoadingUnits
          }
        >
          Create lead
        </Button>
      </div>
    </form>
  );
}
