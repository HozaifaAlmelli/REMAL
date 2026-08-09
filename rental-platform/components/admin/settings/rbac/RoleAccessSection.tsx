"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Save, Trash2 } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import {
  useCreateRole,
  useDeleteRole,
  usePermissionRegistry,
  useRoleTemplates,
  useUpdateRole,
} from "@/lib/hooks/useRbac";
import type { RoleTemplate } from "@/lib/types/rbac.types";
import {
  historicalRolePermissionState,
  normalizeHistoricalRolePermissions,
  rbacMutationErrorMessage,
} from "@/lib/rbac/historical-permission-policy";
import { toastError, toastSuccess } from "@/lib/utils/toast";

const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Enter a role name").max(100),
  description: z.string().trim().max(500).optional(),
});

type CreateRoleValues = z.infer<typeof createRoleSchema>;

export function RoleAccessSection() {
  const rolesQuery = useRoleTemplates();
  const permissionsQuery = usePermissionRegistry();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  useEffect(() => {
    const firstRoleId = roles[0]?.id;
    if (!selectedRoleId && firstRoleId) setSelectedRoleId(firstRoleId);
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (!selectedRole) return;
    setName(selectedRole.name);
    setDescription(selectedRole.description ?? "");
    setPermissionKeys(
      normalizeHistoricalRolePermissions(selectedRole.id, selectedRole.permissions)
    );
  }, [selectedRole]);

  const normalizedPermissions = useMemo(
    () => [...permissionKeys].sort(),
    [permissionKeys]
  );
  const hasChanges = selectedRole
    ? name.trim() !== selectedRole.name ||
      description.trim() !== (selectedRole.description ?? "") ||
      normalizedPermissions.join("|") !==
        [...selectedRole.permissions].sort().join("|")
    : false;

  const togglePermission = (key: string, checked: boolean) => {
    setPermissionKeys((current) =>
      checked
        ? Array.from(new Set([...current, key]))
        : current.filter((permission) => permission !== key)
    );
  };

  const handleSave = () => {
    if (!selectedRole) return;
    updateRole.mutate(
      {
        id: selectedRole.id,
        request: {
          name: name.trim(),
          description: description.trim() || null,
          permissionKeys,
        },
      },
      {
        onSuccess: () =>
          toastSuccess(
            "Role access updated. Operators in this role will be signed out on their next action and receive the updated access when they sign in again."
          ),
        onError: (error: Error) => {
          setName(selectedRole.name);
          setDescription(selectedRole.description ?? "");
          setPermissionKeys(
            normalizeHistoricalRolePermissions(
              selectedRole.id,
              selectedRole.permissions
            )
          );
          toastError(rbacMutationErrorMessage(error, "Could not update role access"));
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedRole) return;
    deleteRole.mutate(selectedRole.id, {
      onSuccess: () => {
        toastSuccess("Role deleted");
        setDeleteOpen(false);
        setSelectedRoleId("");
      },
      onError: (error: Error) =>
        toastError(error.message || "Could not delete role"),
    });
  };

  if (rolesQuery.isError || permissionsQuery.isError) {
    return (
      <EmptyState
        title="Could not load role access"
        description="Retry before changing operator permissions."
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Role access</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Define reusable access profiles for operator accounts.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setCreateOpen(true)}
        >
          Add role
        </Button>
      </div>

      <div className="grid min-h-[480px] overflow-hidden rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 lg:border-b-0 lg:border-e">
          <div className="border-b border-neutral-200 px-3 py-2.5 text-xs font-semibold uppercase text-neutral-600">
            Role templates
          </div>
          {rolesQuery.isLoading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full px-3 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                    selectedRoleId === role.id
                      ? "bg-white text-neutral-900 shadow-[inset_3px_0_0_var(--color-primary-500)]"
                      : "text-neutral-600 hover:bg-white"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{role.name}</span>
                    {role.isSystem && <Badge size="sm">System</Badge>}
                  </span>
                  <span className="mt-1 block text-xs text-neutral-500">
                    {role.assignedUserCount} assigned
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          {!selectedRole || permissionsQuery.isLoading ? (
            <div className="space-y-4 p-5">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 border-b border-neutral-200 p-5 md:grid-cols-2">
                <Input
                  label="Role name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={selectedRole.isSystem}
                  maxLength={100}
                />
                <Textarea
                  label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div className="divide-y divide-neutral-200">
                {permissionsQuery.data?.map((group) => (
                  <div key={group.module} className="p-5">
                    <h3 className="mb-3 text-xs font-semibold uppercase text-neutral-600">
                      {group.module}
                    </h3>
                    <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const state = historicalRolePermissionState(
                          selectedRole.id,
                          permission.key,
                          permissionKeys.includes(permission.key)
                        );
                        const descriptionId = `role-${selectedRole.id}-permission-${permission.key.replace(/[^a-z0-9]/gi, "-")}`;
                        return (
                          <label
                            key={permission.key}
                            className={`flex min-h-14 items-center justify-between gap-4 border-b border-neutral-100 py-2 last:border-b-0 ${state.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <span className="min-w-0" id={descriptionId}>
                              <span className="block text-sm font-medium text-neutral-800">
                                {permission.label}
                              </span>
                              <span className="block text-xs leading-5 text-neutral-500">
                                {permission.description}
                              </span>
                              {state.helperText && (
                                <span className="mt-0.5 block text-xs font-medium text-neutral-600">
                                  {state.helperText}
                                </span>
                              )}
                            </span>
                            <Switch
                              checked={state.checked}
                              disabled={state.disabled}
                              onCheckedChange={(checked) =>
                                togglePermission(permission.key, checked)
                              }
                              aria-label={`${permission.label} for ${selectedRole.name}`}
                              aria-describedby={descriptionId}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="sticky bottom-0 flex items-center justify-between border-t border-neutral-200 bg-white px-5 py-3">
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  disabled={selectedRole.isSystem || selectedRole.assignedUserCount > 0}
                  onClick={() => setDeleteOpen(true)}
                  title={
                    selectedRole.isSystem
                      ? "System roles cannot be deleted"
                      : selectedRole.assignedUserCount > 0
                        ? "Reassign users before deleting this role"
                        : "Delete role"
                  }
                >
                  Delete
                </Button>
                <Button
                  size="sm"
                  leftIcon={<Save className="h-4 w-4" />}
                  disabled={!hasChanges || !name.trim()}
                  isLoading={updateRole.isPending}
                  onClick={handleSave}
                >
                  Save access
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <CreateRoleModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(role) => {
          setSelectedRoleId(role.id);
          setCreateOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete role"
        confirmLabel="Delete role"
        variant="danger"
        isLoading={deleteRole.isPending}
      >
        <p className="text-sm text-neutral-600">
          Delete {selectedRole?.name}? This cannot be undone.
        </p>
      </ConfirmDialog>
    </section>
  );
}

function CreateRoleModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (role: RoleTemplate) => void;
}) {
  const createRole = useCreateRole();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRoleValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: "", description: "" },
  });

  const close = () => {
    reset();
    onClose();
  };

  const submit = (values: CreateRoleValues) => {
    createRole.mutate(
      {
        name: values.name,
        description: values.description || null,
        permissionKeys: [],
      },
      {
        onSuccess: (role) => {
          toastSuccess("Role created. Select its permissions now.");
          reset();
          onCreated(role);
        },
        onError: (error: Error) =>
          toastError(error.message || "Could not create role"),
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Add role" size="md">
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <Input
          label="Role name"
          placeholder="Operations"
          error={errors.name?.message}
          required
          {...register("name")}
        />
        <Textarea
          label="Description"
          placeholder="What this role is responsible for"
          error={errors.description?.message}
          rows={3}
          {...register("description")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createRole.isPending}>
            Add role
          </Button>
        </div>
      </form>
    </Modal>
  );
}
