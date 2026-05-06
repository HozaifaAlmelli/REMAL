"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useConvertToBooking } from "@/lib/hooks/useCrm";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatDateRange, getNights } from "@/lib/utils/format";
import type {
  CrmLeadDetailsResponse,
  ConvertLeadToBookingRequest,
} from "@/lib/types/crm.types";

const convertSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  unitId: z.string().min(1, "Unit is required"),
  checkInDate: z.string().min(1, "Check-in date is required"),
  checkOutDate: z.string().min(1, "Check-out date is required"),
  guestCount: z
    .number({ invalid_type_error: "Guest count is required" })
    .min(1),
  internalNotes: z.string().optional(),
});

interface ConvertToBookingPanelProps {
  leadId: string;
  lead: CrmLeadDetailsResponse;
}

export function ConvertToBookingPanel({
  leadId,
  lead,
}: ConvertToBookingPanelProps) {
  const { canManageCRM } = usePermissions();
  const convertMutation = useConvertToBooking(leadId);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConvertLeadToBookingRequest>({
    resolver: zodResolver(convertSchema),
    defaultValues: {
      clientId: lead.clientId ?? "",
      unitId: lead.targetUnitId ?? "",
      checkInDate: lead.desiredCheckInDate ?? "",
      checkOutDate: lead.desiredCheckOutDate ?? "",
      guestCount: lead.guestCount ?? 1,
      internalNotes: "",
    },
  });

  const onSubmit = (data: ConvertLeadToBookingRequest) => {
    convertMutation.mutate(data);
  };

  const nights =
    lead.desiredCheckInDate && lead.desiredCheckOutDate
      ? getNights(lead.desiredCheckInDate, lead.desiredCheckOutDate)
      : 0;

  if (lead.leadStatus !== "converted") {
    return null;
  }

  return (
    <div className="bg-primary-50/30 space-y-4 rounded-lg border border-primary-200 p-4">
      <h3 className="text-sm font-semibold text-primary-800">
        Convert to Booking
      </h3>

      {/* Summary */}
      {lead.targetUnitId && (
        <div className="text-sm text-neutral-600">
          <p>Unit: {lead.targetUnitName || lead.targetUnitId}</p>
          {lead.desiredCheckInDate && lead.desiredCheckOutDate && (
            <p>
              Dates:{" "}
              {formatDateRange(
                lead.desiredCheckInDate,
                lead.desiredCheckOutDate
              )}{" "}
              ({nights} nights)
            </p>
          )}
          {lead.guestCount && <p>Guests: {lead.guestCount}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input
          label="Client ID"
          {...register("clientId")}
          error={errors.clientId?.message}
          required
          disabled={convertMutation.isPending}
        />
        <Input
          label="Unit ID"
          {...register("unitId")}
          error={errors.unitId?.message}
          required
          disabled={convertMutation.isPending}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Check-in Date"
            type="date"
            {...register("checkInDate")}
            error={errors.checkInDate?.message}
            required
            disabled={convertMutation.isPending}
          />
          <Input
            label="Check-out Date"
            type="date"
            {...register("checkOutDate")}
            error={errors.checkOutDate?.message}
            required
            disabled={convertMutation.isPending}
          />
        </div>
        <Input
          label="Guest Count"
          type="number"
          {...register("guestCount", { valueAsNumber: true })}
          error={errors.guestCount?.message}
          required
          disabled={convertMutation.isPending}
        />
        <div className="w-full">
          <textarea
            {...register("internalNotes")}
            placeholder="Internal notes (optional)"
            className="h-20 w-full resize-none rounded-md border border-neutral-200 p-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
            disabled={convertMutation.isPending}
          />
        </div>

        {canManageCRM && (
          <Button
            type="submit"
            isLoading={convertMutation.isPending}
            disabled={convertMutation.isPending}
            className="w-full"
          >
            Convert to Booking
          </Button>
        )}
      </form>
    </div>
  );
}
