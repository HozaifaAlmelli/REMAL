"use client";

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
import type { CreateCrmLeadRequest } from "@/lib/types/crm.types";

const BOOKING_SOURCE_OPTIONS = Object.entries(BOOKING_SOURCE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  })
);

const createLeadSchema = z.object({
  contactName: z.string().min(1, "Contact name is required"),
  contactPhone: z.string().min(1, "Phone is required"),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  targetUnitId: z.string().optional(),
  desiredCheckInDate: z.date().optional(),
  desiredCheckOutDate: z.date().optional(),
  guestCount: z
    .union([z.number().int().min(1, "Must be at least 1"), z.nan()])
    .optional(),
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

  const { data: unitsData, isLoading: isLoadingUnits } = useInternalUnitsList({
    pageSize: 500,
  });
  const unitOptions = (unitsData?.items ?? []).map((u) => ({
    value: u.id,
    label: u.name,
  }));

  const handleFormSubmit = (values: FormValues) => {
    // Only parse valid numbers
    const validGuestCount =
      values.guestCount !== undefined && !Number.isNaN(values.guestCount)
        ? values.guestCount
        : undefined;

    const payload: CreateCrmLeadRequest = {
      contactName: values.contactName.trim(),
      contactPhone: values.contactPhone.trim(),
      contactEmail: values.contactEmail?.trim() || undefined,
      targetUnitId: values.targetUnitId || undefined,
      desiredCheckInDate: values.desiredCheckInDate
        ? [
          values.desiredCheckInDate.getFullYear(),
          String(values.desiredCheckInDate.getMonth() + 1).padStart(2, "0"),
          String(values.desiredCheckInDate.getDate()).padStart(2, "0"),
        ].join("-")
        : undefined,
      desiredCheckOutDate: values.desiredCheckOutDate
        ? [
          values.desiredCheckOutDate.getFullYear(),
          String(values.desiredCheckOutDate.getMonth() + 1).padStart(2, "0"),
          String(values.desiredCheckOutDate.getDate()).padStart(2, "0"),
        ].join("-")
        : undefined,
      guestCount: validGuestCount,
      source: values.source,
      notes: values.notes?.trim() || undefined,
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Contact Name"
          {...register("contactName")}
          error={errors.contactName?.message}
          required
          disabled={isLoading}
        />
        <Input
          label="Phone"
          type="tel"
          {...register("contactPhone")}
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
        <Input
          label="Guest Count"
          type="number"
          {...register("guestCount", { valueAsNumber: true })}
          error={errors.guestCount?.message}
          disabled={isLoading}
        />
      </div>

      <div className="w-full">
        <label className="mb-1.5 block text-sm font-medium text-neutral-700">
          Target Unit (optional)
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
                isLoadingUnits ? "Loading units..." : "Search units..."
              }
              disabled={isLoading || isLoadingUnits}
            />
          )}
        />
      </div>

      <DateRangePicker
        label="Desired Dates (optional)"
        value={{
          from: watch("desiredCheckInDate") || null,
          to: watch("desiredCheckOutDate") || null,
        }}
        onChange={(range) => {
          setValue("desiredCheckInDate", range.from || undefined);
          setValue("desiredCheckOutDate", range.to || undefined);
        }}
      />

      <div className="w-full">
        <label className="mb-1.5 block text-sm font-medium text-neutral-700">
          Notes (optional)
        </label>
        <textarea
          {...register("notes")}
          placeholder="Notes..."
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
        <Button type="submit" isLoading={isLoading}>
          Create Lead
        </Button>
      </div>
    </form>
  );
}
