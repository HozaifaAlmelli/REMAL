"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Building2, Plus, AlertCircle } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/utils/toast";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { OwnerListFilters } from "@/lib/types/owner.types";

import { useOwners, useUpdateOwnerStatus } from "@/lib/hooks/useOwners";
import { OwnerFilters } from "@/components/admin/owners/OwnerFilters";
import { OwnerTable } from "@/components/admin/owners/OwnerTable";
import { ROUTES } from "@/lib/constants/routes";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

export default function OwnersPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-6">
          <SkeletonTable columns={6} rows={8} />
        </div>
      }
    >
      <OwnersPageContent />
    </React.Suspense>
  );
}

function OwnersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canManageOwners } = usePermissions();

  const page = Number(searchParams.get("page")) || DEFAULT_PAGE;
  const pageSize = Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const includeInactive = searchParams.get("includeInactive") === "true";
  const search = searchParams.get("search") || undefined;

  const filters: OwnerListFilters = React.useMemo(
    () => ({
      includeInactive,
      search,
      page,
      pageSize,
    }),
    [includeInactive, page, pageSize, search]
  );

  const {
    data: paginatedOwners,
    isLoading,
    isFetching,
    isError,
  } = useOwners(filters);
  const { mutateAsync: updateStatus } = useUpdateOwnerStatus();

  // Status toggle confirmation
  const [statusConfirmOwner, setStatusConfirmOwner] = React.useState<
    { id: string; name: string; status: "active" | "inactive" } | undefined
  >();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    params.set("pageSize", String(pageSize));
    params.set("includeInactive", String(includeInactive));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleFilterChange = (newFilters: OwnerListFilters) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newFilters.page ?? DEFAULT_PAGE));
    params.set("pageSize", String(newFilters.pageSize ?? pageSize));

    if (newFilters.includeInactive) {
      params.set("includeInactive", "true");
    } else {
      params.delete("includeInactive");
    }

    if (newFilters.search) {
      params.set("search", newFilters.search);
    } else {
      params.delete("search");
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleToggleStatusRequest = (owner: {
    id: string;
    name: string;
    status: "active" | "inactive";
  }) => {
    setStatusConfirmOwner(owner);
  };

  const confirmToggleStatus = async () => {
    if (!statusConfirmOwner) return;
    try {
      const newStatus =
        statusConfirmOwner.status === "active" ? "inactive" : "active";
      await updateStatus({
        id: statusConfirmOwner.id,
        status: newStatus,
      });
      toastSuccess(
        newStatus === "active" ? "Owner activated" : "Owner deactivated"
      );
    } catch (e: unknown) {
      toastError((e as Error)?.message || "Could not update owner status");
    } finally {
      setStatusConfirmOwner(undefined);
    }
  };

  if (isError) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<AlertCircle className="h-10 w-10 text-red-500" />}
          title="Could not load owners"
          description="We could not load owner records. Retry the page or adjust your filters."
        />
      </div>
    );
  }

  const hasFilters = Boolean(includeInactive || search);
  const noOwnersAtAll =
    !isLoading &&
    paginatedOwners?.pagination?.totalCount === 0 &&
    page === 1 &&
    !hasFilters;
  const noOwnersFound =
    !isLoading &&
    paginatedOwners?.pagination?.totalCount === 0 &&
    page === 1 &&
    hasFilters;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Owners
          </h1>
          <p className="text-sm text-neutral-500">
            Manage owner profiles, commission rates, units, and payout records.
          </p>
        </div>
        {canManageOwners && (
          <Button
            onClick={() => router.push(ROUTES.admin.owners.create)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create owner
          </Button>
        )}
      </div>

      <OwnerFilters
        filters={filters}
        onChange={handleFilterChange}
        isFetching={isFetching}
      />

      {isLoading ? (
        <SkeletonTable columns={6} rows={8} />
      ) : noOwnersAtAll ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10 text-neutral-400" />}
          title="Owner list is empty"
          description="Create the first owner before assigning units or tracking payouts."
          action={
            canManageOwners ? (
              <Button onClick={() => router.push(ROUTES.admin.owners.create)}>
                Create owner
              </Button>
            ) : undefined
          }
        />
      ) : noOwnersFound ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10 text-neutral-400" />}
          title="No matching owners"
          description="No owner records match these filters. Clear the search or include inactive owners."
        />
      ) : (
        <OwnerTable
          data={paginatedOwners?.items || []}
          pagination={
            paginatedOwners?.pagination || {
              page: 1,
              pageSize: 10,
              totalCount: 0,
              totalPages: 0,
            }
          }
          isLoading={isLoading}
          onPageChange={handlePageChange}
          onToggleStatus={handleToggleStatusRequest}
        />
      )}

      {canManageOwners && (
        <ConfirmDialog
          isOpen={!!statusConfirmOwner}
          onCancel={() => setStatusConfirmOwner(undefined)}
          onConfirm={confirmToggleStatus}
          title={
            statusConfirmOwner?.status === "active"
              ? "Deactivate Owner"
              : "Activate Owner"
          }
          description={
            statusConfirmOwner?.status === "active"
              ? `Deactivate "${statusConfirmOwner?.name}"? They will no longer be treated as an active owner.`
              : `Activate "${statusConfirmOwner?.name}"? They will be available for active unit and payout workflows.`
          }
          confirmLabel={
            statusConfirmOwner?.status === "active"
              ? "Deactivate owner"
              : "Activate owner"
          }
          variant={
            statusConfirmOwner?.status === "active" ? "danger" : "primary"
          }
        />
      )}
    </div>
  );
}
