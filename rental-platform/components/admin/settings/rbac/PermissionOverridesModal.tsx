"use client";

import { useEffect, useState } from "react";
import { Check, CircleMinus, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  usePermissionRegistry,
  useUpdateUserOverrides,
  useUserOverrides,
} from "@/lib/hooks/useRbac";
import { cn } from "@/lib/utils/cn";
import { toastError, toastSuccess } from "@/lib/utils/toast";
import {
  isOwnerCorrectionOverrideProtected,
  rbacMutationErrorMessage,
  SUPERADMIN_ROLE_TEMPLATE_ID,
} from "@/lib/rbac/historical-permission-policy";

type OverrideMode = "inherit" | "grant" | "deny";

export function PermissionOverridesModal({
  isOpen,
  adminUserId,
  adminUserName,
  adminRoleTemplateId,
  onClose,
}: {
  isOpen: boolean;
  adminUserId: string;
  adminUserName: string;
  adminRoleTemplateId: string;
  onClose: () => void;
}) {
  const registry = usePermissionRegistry();
  const overrides = useUserOverrides(adminUserId, isOpen);
  const updateOverrides = useUpdateUserOverrides();
  const [modes, setModes] = useState<Record<string, OverrideMode>>({});

  useEffect(() => {
    if (!overrides.data) return;
    setModes(modesFromOverrides(overrides.data.grants, overrides.data.denies));
  }, [overrides.data]);

  const handleSave = () => {
    const grants = Object.entries(modes)
      .filter(([, mode]) => mode === "grant")
      .map(([key]) => key);
    const denies = Object.entries(modes)
      .filter(([, mode]) => mode === "deny")
      .map(([key]) => key);

    updateOverrides.mutate(
      { adminUserId, request: { grants, denies } },
      {
        onSuccess: () => {
          toastSuccess(
            "Permission overrides updated. This operator will be signed out on their next action and receive the updated access when they sign in again."
          );
          onClose();
        },
        onError: (error: Error) => {
          setModes(
            modesFromOverrides(
              overrides.data?.grants ?? [],
              overrides.data?.denies ?? []
            )
          );
          toastError(
            rbacMutationErrorMessage(error, "Could not update permission overrides")
          );
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Permission overrides: ${adminUserName}`}
      size="xl"
    >
      {registry.isError || overrides.isError ? (
        <EmptyState
          title="Could not load permissions"
          description="Close this window and retry before changing access."
        />
      ) : registry.isLoading || overrides.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-neutral-200 pb-3 text-xs text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <CircleMinus className="h-3.5 w-3.5" /> Inherited from role
            </span>
            <span className="inline-flex items-center gap-1.5 text-primary-700">
              <Check className="h-3.5 w-3.5" /> Explicitly granted
            </span>
            <span className="inline-flex items-center gap-1.5 text-error">
              <ShieldOff className="h-3.5 w-3.5" /> Explicitly denied
            </span>
          </div>

          <div className="divide-y divide-neutral-200">
            {registry.data?.map((group) => (
              <section key={group.module} className="py-4 first:pt-0">
                <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-600">
                  {group.module}
                </h3>
                <div className="space-y-1">
                  {group.permissions.map((permission) => {
                    const mode = modes[permission.key] ?? "inherit";
                    const inherited = overrides.data?.inherited.includes(permission.key);
                    const correctionProtected =
                      isOwnerCorrectionOverrideProtected(permission.key);
                    const correctionHelper = correctionProtected
                      ? adminRoleTemplateId === SUPERADMIN_ROLE_TEMPLATE_ID
                        ? "Mandatory through the SuperAdmin role; user overrides are disabled."
                        : "Restricted to the SuperAdmin role; user overrides are disabled."
                      : null;
                    return (
                      <div
                        key={permission.key}
                        className="grid gap-3 py-2 md:grid-cols-[minmax(0,1fr)_270px] md:items-center"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-neutral-800">
                              {permission.label}
                            </span>
                            {mode === "inherit" && (
                              <span className="text-xs text-neutral-500">
                                {inherited ? "Allowed by role" : "Not allowed by role"}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                            {permission.description}
                          </p>
                          {correctionHelper && (
                            <p className="mt-0.5 text-xs font-medium text-neutral-600">
                              {correctionHelper}
                            </p>
                          )}
                        </div>
                        <div
                          className="grid grid-cols-3 overflow-hidden rounded-[var(--portal-radius-control)] border border-neutral-300"
                          role="group"
                          aria-label={`${permission.label} override`}
                        >
                          {(["inherit", "grant", "deny"] as const).map((option) => (
                            <button
                              key={option}
                              type="button"
                              disabled={correctionProtected}
                              onClick={() =>
                                setModes((current) => ({
                                  ...current,
                                  [permission.key]: option,
                                }))
                              }
                              className={cn(
                                "h-8 border-e border-neutral-300 px-2 text-xs font-medium capitalize transition-colors last:border-e-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
                                mode === option && option === "inherit" &&
                                  "bg-neutral-200 text-neutral-900",
                                mode === option && option === "grant" &&
                                  "bg-primary-600 text-white",
                                mode === option && option === "deny" &&
                                  "bg-error text-white",
                                mode !== option && "bg-white text-neutral-600 hover:bg-neutral-50",
                                correctionProtected && "cursor-not-allowed opacity-50"
                              )}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={updateOverrides.isPending}>
              Save overrides
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function modesFromOverrides(
  grants: readonly string[],
  denies: readonly string[]
): Record<string, OverrideMode> {
  const next: Record<string, OverrideMode> = {};
  for (const key of grants) {
    if (!isOwnerCorrectionOverrideProtected(key)) next[key] = "grant";
  }
  for (const key of denies) {
    if (!isOwnerCorrectionOverrideProtected(key)) next[key] = "deny";
  }
  return next;
}
