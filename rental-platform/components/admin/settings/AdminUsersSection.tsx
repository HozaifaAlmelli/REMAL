"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/utils/toast";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useAdminUsers,
  useChangeAdminRole,
  useToggleAdminStatus,
} from "@/lib/hooks/useAdminUsers";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { AdminUserTable } from "./AdminUserTable";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { CreateAdminUserModal } from "./CreateAdminUserModal";
import { PermissionOverridesModal } from "./rbac/PermissionOverridesModal";

export function AdminUsersSection() {
  const { canManageAdminUsers } = usePermissions();
  const [roleDialog, setRoleDialog] = useState<{
    isOpen: boolean;
    userId: string;
    currentRoleTemplateId: string;
    currentRoleName: string;
  }>({ isOpen: false, userId: "", currentRoleTemplateId: "", currentRoleName: "" });

  const [overridesDialog, setOverridesDialog] = useState({
    isOpen: false,
    userId: "",
    userName: "",
    roleTemplateId: "",
  });

  const [statusDialog, setStatusDialog] = useState<{
    isOpen: boolean;
    userId: string;
    currentIsActive: boolean;
  }>({ isOpen: false, userId: "", currentIsActive: true });

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data, isLoading, isError } = useAdminUsers({ includeInactive: true });
  const changeRoleMutation = useChangeAdminRole();
  const toggleStatusMutation = useToggleAdminStatus();

  if (isError) {
    return (
      <EmptyState
        title="Could not load admin users"
        description="We could not load admin users. Retry before changing access."
      />
    );
  }

  const handleOpenRoleDialog = (
    userId: string,
    currentRoleTemplateId: string,
    currentRoleName: string
  ) => {
    setRoleDialog({ isOpen: true, userId, currentRoleTemplateId, currentRoleName });
  };

  const handleCloseRoleDialog = () => {
    setRoleDialog({ isOpen: false, userId: "", currentRoleTemplateId: "", currentRoleName: "" });
  };

  const handleRoleConfirm = (roleTemplateId: string) => {
    changeRoleMutation.mutate(
      { id: roleDialog.userId, roleTemplateId },
      {
        onSuccess: () => {
          toastSuccess(
            "Admin role updated. Their previous session has been revoked."
          );
          handleCloseRoleDialog();
        },
        onError: (error: Error) => {
          toastError(error.message || "Could not update admin role");
        },
      }
    );
  };

  const handleOpenStatusDialog = (userId: string, currentIsActive: boolean) => {
    setStatusDialog({ isOpen: true, userId, currentIsActive });
  };

  const handleCloseStatusDialog = () => {
    setStatusDialog({ isOpen: false, userId: "", currentIsActive: true });
  };

  const handleStatusConfirm = () => {
    toggleStatusMutation.mutate(
      { id: statusDialog.userId, isActive: !statusDialog.currentIsActive },
      {
        onSuccess: () => {
          toastSuccess(
            "Admin user status updated. An active session ends within 15 minutes."
          );
          handleCloseStatusDialog();
        },
        onError: (error: Error) => {
          toastError(error.message || "Could not update admin status");
        },
      }
    );
  };

  if (!canManageAdminUsers) {
    return (
      <EmptyState
        title="Admin user access required"
        description="Only super admins can manage admin users and role access."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Admin users</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Create operator accounts, assign roles, and deactivate access when
            needed.
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Create admin user
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={10} columns={6} />
      ) : data?.items && data.items.length > 0 ? (
        <AdminUserTable
          users={data.items}
          isLoading={isLoading}
          onChangeRole={handleOpenRoleDialog}
          onToggleStatus={handleOpenStatusDialog}
          onEditOverrides={(userId, userName, roleTemplateId) =>
            setOverridesDialog({ isOpen: true, userId, userName, roleTemplateId })
          }
        />
      ) : (
        <EmptyState
          title="No admin users created"
          description="Create the first admin user to grant portal access."
        />
      )}

      <CreateAdminUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <ChangeRoleDialog
        isOpen={roleDialog.isOpen}
        onClose={handleCloseRoleDialog}
        currentRoleTemplateId={roleDialog.currentRoleTemplateId}
        currentRoleName={roleDialog.currentRoleName}
        onConfirm={handleRoleConfirm}
        isLoading={changeRoleMutation.isPending}
      />

      <PermissionOverridesModal
        isOpen={overridesDialog.isOpen}
        adminUserId={overridesDialog.userId}
        adminUserName={overridesDialog.userName}
        adminRoleTemplateId={overridesDialog.roleTemplateId}
        onClose={() =>
          setOverridesDialog({
            isOpen: false,
            userId: "",
            userName: "",
            roleTemplateId: "",
          })
        }
      />

      <ConfirmDialog
        isOpen={statusDialog.isOpen}
        onClose={handleCloseStatusDialog}
        title={
          statusDialog.currentIsActive
            ? "Deactivate admin user"
            : "Activate admin user"
        }
        onConfirm={handleStatusConfirm}
        isLoading={toggleStatusMutation.isPending}
        confirmLabel={
          statusDialog.currentIsActive
            ? "Deactivate admin user"
            : "Activate admin user"
        }
        variant={statusDialog.currentIsActive ? "danger" : "primary"}
      >
        <p className="text-sm text-neutral-600">
          {statusDialog.currentIsActive
            ? "Deactivate this admin user? They will no longer be able to sign in."
            : "Activate this admin user? They will be able to sign in again."}
        </p>
      </ConfirmDialog>
    </div>
  );
}
