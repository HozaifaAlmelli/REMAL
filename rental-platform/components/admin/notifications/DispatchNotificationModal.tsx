"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  useSendAdminNotification,
  useSendClientNotification,
  useSendOwnerNotification,
} from "@/lib/hooks/useNotifications";
import { useAdminUsers } from "@/lib/hooks/useAdminUsers";
import { useClients } from "@/lib/hooks/useClients";
import { useOwners } from "@/lib/hooks/useOwners";
import { toast } from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import type { NotificationChannel } from "@/lib/types/notification.types";

const dispatchSchema = z.object({
  recipientType: z.enum(["Admin", "Client", "Owner"]),
  recipientId: z.string().min(1, "Recipient is required"),
  templateCode: z.string().min(1, "Template code is required"),
  scheduledAt: z.string().optional(),
  channel: z.enum(["email", "in_app"]),
});

type DispatchFormData = z.infer<typeof dispatchSchema>;

interface DispatchNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RECIPIENT_TYPE_OPTIONS = [
  { value: "Admin", label: "Admin User" },
  { value: "Client", label: "Client" },
  { value: "Owner", label: "Owner" },
];

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "in_app", label: "In-app" },
];

export function DispatchNotificationModal({
  isOpen,
  onClose,
}: DispatchNotificationModalProps) {
  const [variableEntries, setVariableEntries] = useState<
    { key: string; value: string }[]
  >([]);

  // Mutations for each recipient type
  const sendAdminMutation = useSendAdminNotification();
  const sendClientMutation = useSendClientNotification();
  const sendOwnerMutation = useSendOwnerNotification();

  const isSending =
    sendAdminMutation.isPending ||
    sendClientMutation.isPending ||
    sendOwnerMutation.isPending;

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DispatchFormData>({
    resolver: zodResolver(dispatchSchema),
    defaultValues: {
      recipientType: "Admin",
      recipientId: "",
      templateCode: "",
      channel: "in_app",
      scheduledAt: "",
    },
  });

  const recipientType = watch("recipientType");

  // Fetch recipient lists based on type
  const { data: adminUsers } = useAdminUsers();
  const { data: clients } = useClients();
  const { data: owners } = useOwners();

  // Build recipient options for combobox
  const recipientOptions = (() => {
    switch (recipientType) {
      case "Admin":
        return (adminUsers?.items ?? []).map((u) => ({
          value: u.id,
          label: `${u.name} (${u.email})`,
        }));
      case "Client":
        return (clients?.items ?? []).map((c) => ({
          value: c.id,
          label: `${c.name} (${c.phone})`,
        }));
      case "Owner":
        return (owners?.items ?? []).map((o) => ({
          value: o.id,
          label: `${o.name} (${o.phone})`,
        }));
      default:
        return [];
    }
  })();

  // Reset recipientId when type changes
  useEffect(() => {
    setValue("recipientId", "");
  }, [recipientType, setValue]);

  // Variable management
  const addVariable = () => {
    setVariableEntries((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeVariable = (index: number) => {
    setVariableEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariable = (
    index: number,
    field: "key" | "value",
    val: string
  ) => {
    setVariableEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: val } : entry))
    );
  };

  // Build variables object from entries
  const buildVariables = (): Record<string, string> | undefined => {
    const vars: Record<string, string> = {};
    for (const entry of variableEntries) {
      if (entry.key.trim() && entry.value.trim()) {
        vars[entry.key.trim()] = entry.value.trim();
      }
    }
    return Object.keys(vars).length > 0 ? vars : undefined;
  };

  // Submit handler
  const onSubmit = (data: DispatchFormData) => {
    const payload = {
      templateCode: data.templateCode,
      channel: data.channel as NotificationChannel,
      variables: buildVariables(),
      scheduledAt: data.scheduledAt || undefined,
    };

    const mutationConfig = {
      onSuccess: () => {
        toast.success("Notification sent successfully");
        handleClose();
      },
    };

    switch (data.recipientType) {
      case "Admin":
        sendAdminMutation.mutate(
          { adminUserId: data.recipientId, data: payload },
          mutationConfig
        );
        break;
      case "Client":
        sendClientMutation.mutate(
          { clientId: data.recipientId, data: payload },
          mutationConfig
        );
        break;
      case "Owner":
        sendOwnerMutation.mutate(
          { ownerId: data.recipientId, data: payload },
          mutationConfig
        );
        break;
    }
  };

  const handleClose = () => {
    reset();
    setVariableEntries([]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Send Notification"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Recipient Type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Recipient Type
          </label>
          <select
            {...register("recipientType")}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {RECIPIENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.recipientType && (
            <p className="mt-1 text-xs text-error">
              {errors.recipientType.message}
            </p>
          )}
        </div>

        {/* Recipient */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Recipient
          </label>
          <select
            {...register("recipientId")}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Select a {recipientType.toLowerCase()}...</option>
            {recipientOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.recipientId && (
            <p className="mt-1 text-xs text-error">
              {errors.recipientId.message}
            </p>
          )}
        </div>

        {/* Template Code */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Template Code
          </label>
          <input
            type="text"
            placeholder="e.g., BOOKING_CONFIRMED"
            {...register("templateCode")}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {errors.templateCode && (
            <p className="mt-1 text-xs text-error">
              {errors.templateCode.message}
            </p>
          )}
        </div>

        {/* Channel */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Channel
          </label>
          <select
            {...register("channel")}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.channel && (
            <p className="mt-1 text-xs text-error">{errors.channel.message}</p>
          )}
        </div>

        {/* Variables (dynamic key/value) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-neutral-700">
              Template Variables (optional)
            </label>
            <button
              type="button"
              onClick={addVariable}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary-600 hover:bg-primary-50"
            >
              <Plus className="h-4 w-4" />
              Add Variable
            </button>
          </div>
          {variableEntries.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Key (e.g., clientName)"
                value={entry.key}
                onChange={(e) => updateVariable(index, "key", e.target.value)}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Value (e.g., Ahmed)"
                value={entry.value}
                onChange={(e) => updateVariable(index, "value", e.target.value)}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => removeVariable(index)}
                className="p-2 text-neutral-400 hover:text-error"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Scheduled At */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Schedule (optional)
          </label>
          <input
            type="datetime-local"
            {...register("scheduledAt")}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {errors.scheduledAt && (
            <p className="mt-1 text-xs text-error">
              {errors.scheduledAt.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSending}
            disabled={isSending}
          >
            Send Notification
          </Button>
        </div>
      </form>
    </Modal>
  );
}
