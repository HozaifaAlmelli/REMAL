"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError } from "@/lib/utils/toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useCreateOwner, useUpdateOwner } from "@/lib/hooks/useOwners";
import { ROUTES } from "@/lib/constants/routes";
import { ApiError } from "@/lib/api/api-error";
import type {
  OwnerFormValues,
  CreateOwnerRequest,
} from "@/lib/types/owner.types";

const ownerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().optional(),
  commissionRate: z
    .number()
    .min(0, "Cannot be negative")
    .max(100, "Cannot exceed 100%"),
  status: z.enum(["active", "inactive"], {
    required_error: "Status is required",
  }),
  notes: z.string().optional(),
});

interface OwnerFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<OwnerFormValues>;
  onSubmitSuccess?: () => void;
}

export function OwnerForm({
  mode,
  defaultValues,
  onSubmitSuccess,
}: OwnerFormProps) {
  const router = useRouter();
  const { mutateAsync: createOwner, isPending: isCreating } = useCreateOwner();
  const { mutateAsync: updateOwner, isPending: isUpdating } = useUpdateOwner();

  const isLoading = mode === "create" ? isCreating : isUpdating;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<OwnerFormValues>({
    resolver: zodResolver(ownerFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      password: "",
      commissionRate: defaultValues?.commissionRate ?? 0,
      status: defaultValues?.status ?? "active",
      notes: defaultValues?.notes ?? "",
    },
  });

  const onSubmit = async (data: OwnerFormValues) => {
    try {
      // Prepare request body
      const requestBody: {
        name: string;
        phone: string;
        email?: string;
        password?: string;
        commissionRate: number;
        status: "active" | "inactive";
        notes?: string;
      } = {
        name: data.name,
        phone: data.phone,
        commissionRate: data.commissionRate,
        status: data.status,
      };

      if (mode === "create") {
        if (!data.password || data.password.trim().length === 0) {
          toastError("Password is required");
          return;
        }
        requestBody.password = data.password;
      }

      // Only include email if it's not empty
      if (data.email && data.email.trim() !== "") {
        requestBody.email = data.email.trim();
      }

      // Only include notes if it's not empty
      if (data.notes && data.notes.trim() !== "") {
        requestBody.notes = data.notes.trim();
      }

      if (mode === "create") {
        await createOwner(requestBody as CreateOwnerRequest);
        toastSuccess("Owner created successfully");
        router.push(ROUTES.admin.owners.list);
      } else {
        // For edit mode, we need the owner ID from defaultValues
        const ownerId = defaultValues?.id;
        if (!ownerId) {
          throw new Error("Owner ID is required for update");
        }
        await updateOwner({ id: ownerId, data: requestBody });
        toastSuccess("Owner updated successfully");
        router.push(ROUTES.admin.owners.detail(ownerId));
      }

      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err) {
      if (err instanceof ApiError && err.hasFieldErrors()) {
        // Field-level validation errors (422)
        toastError(err.errors.join(", "));
      } else {
        toastError((err as Error)?.message || "An error occurred");
      }
    }
  };

  const statusOptions = [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Input
            label="Name"
            {...register("name")}
            error={errors.name?.message}
            disabled={isLoading}
            placeholder="e.g. John Smith"
          />

          <Input
            label="Phone"
            {...register("phone")}
            error={errors.phone?.message}
            disabled={isLoading}
            placeholder="e.g. +1234567890"
          />

          <Input
            label="Email (Optional)"
            {...register("email")}
            error={errors.email?.message}
            disabled={isLoading}
            placeholder="e.g. john@example.com"
            type="email"
          />

          {mode === "create" && (
            <Input
              label="Password"
              type="password"
              {...register("password")}
              error={errors.password?.message}
              disabled={isLoading}
              placeholder="Set owner account password"
            />
          )}

          <Input
            label="Commission Rate (%)"
            type="number"
            {...register("commissionRate", { valueAsNumber: true })}
            error={errors.commissionRate?.message}
            disabled={isLoading}
            min={0}
            max={100}
            step="0.01"
            placeholder="e.g. 20 for 20%"
          />
        </div>

        <div className="space-y-4">
          <Select
            label="Status"
            options={statusOptions}
            error={errors.status?.message}
            disabled={isLoading}
            placeholder="Select status"
            onChange={(value) =>
              setValue("status", value as "active" | "inactive")
            }
          />

          <Textarea
            label="Notes (Optional)"
            {...register("notes")}
            error={errors.notes?.message}
            disabled={isLoading}
            placeholder="Additional information about this owner..."
            rows={6}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <Button type="submit" disabled={isLoading} isLoading={isLoading}>
          {mode === "create" ? "Create Owner" : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(ROUTES.admin.owners.list)}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
