"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toastSuccess, toastError } from "@/lib/utils/toast";
import { cn } from "@/lib/utils/cn";
import {
  useOwner,
  useOwnerFinancialSummary,
  useUpdateOwnerStatus,
} from "@/lib/hooks/useOwners";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { OwnerDetailHeader } from "@/components/admin/owners/OwnerDetailHeader";
import { OwnerFinancialSummary } from "@/components/admin/owners/OwnerFinancialSummary";
import { OwnerUnitsList } from "@/components/admin/owners/OwnerUnitsList";
import { OwnerPayoutsTab } from "@/components/admin/owners/OwnerPayoutsTab";
import { ROUTES } from "@/lib/constants/routes";

interface OwnerDetailPageProps {
  params: { id: string };
}

export default function OwnerDetailPage({ params }: OwnerDetailPageProps) {
  const { id } = params;
  const router = useRouter();

  const { canViewFinance } = usePermissions();
  const { data: owner, isLoading, isError } = useOwner(id);
  const { data: financialSummary, isLoading: isFinancialLoading } =
    useOwnerFinancialSummary(id, { enabled: canViewFinance });
  const { mutateAsync: updateStatus, isPending: isStatusPending } =
    useUpdateOwnerStatus();

  const [activeTab, setActiveTab] = React.useState<
    "overview" | "payouts" | "units"
  >("overview");

  const [statusConfirmOpen, setStatusConfirmOpen] = React.useState(false);

  const handleConfirmStatusChange = async () => {
    if (!owner) return;
    try {
      const newStatus = owner.status === "active" ? "inactive" : "active";
      await updateStatus({ id, status: newStatus });
      toastSuccess(
        newStatus === "active"
          ? "Owner activated"
          : "Owner deactivated"
      );
    } catch (e: unknown) {
      toastError((e as Error)?.message || "Could not update owner status");
    } finally {
      setStatusConfirmOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-4 w-72 animate-pulse rounded bg-neutral-100" />
        </div>
        {/* Financial summary skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-neutral-100"
            />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="h-32 animate-pulse rounded-lg bg-neutral-100" />
      </div>
    );
  }

  if (isError || !owner) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 w-fit text-neutral-500"
          onClick={() => router.push(ROUTES.admin.owners.list)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to owners
        </Button>
        <EmptyState
          icon={<AlertCircle className="h-10 w-10 text-red-400" />}
          title="Owner not found"
          description="This owner may have been removed, or the link may use an incorrect ID."
          action={
            <Button onClick={() => router.push(ROUTES.admin.owners.list)}>
              Back to owners
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 w-fit text-neutral-500 hover:text-neutral-900"
        onClick={() => router.push(ROUTES.admin.owners.list)}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to owners
      </Button>

      {/* Header */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <OwnerDetailHeader
          owner={owner}
          onEdit={() => router.push(ROUTES.admin.owners.edit(id))}
          onChangeStatus={() => setStatusConfirmOpen(true)}
          isLoading={isStatusPending}
        />
      </div>

      {/* Financial Summary */}
      {canViewFinance && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-700">
            Payout summary
          </h2>
          <OwnerFinancialSummary
            summary={
              financialSummary || {
                ownerId: id,
                totalPending: 0,
                totalScheduled: 0,
                totalPaid: 0,
              }
            }
            isLoading={isFinancialLoading}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200">
          <nav className="-mb-px flex gap-1 overflow-x-auto px-6">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === "overview"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
              )}
            >
              Overview
            </button>
            {canViewFinance && (
              <button
                type="button"
                onClick={() => setActiveTab("payouts")}
                className={cn(
                  "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === "payouts"
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
                )}
              >
                Payouts
              </button>
            )}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <>
              {/* Units Section (Backend Gap) */}
              <div className="mb-6">
                <h2 className="mb-3 text-sm font-semibold text-neutral-700">
                  Assigned units
                </h2>
                <OwnerUnitsList />
              </div>

              {/* Detailed address Section */}
              {owner.detailedAddress && (
                <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-neutral-700">
                    Detailed address
                  </h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                    {owner.detailedAddress}
                  </p>
                </div>
              )}

              {/* Notes Section */}
              {owner.notes && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-neutral-700">
                    Notes
                  </h2>
                  <p className="text-sm leading-relaxed text-neutral-700">
                    {owner.notes}
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === "payouts" && <OwnerPayoutsTab ownerId={id} />}
        </div>
      </div>

      {/* Status change confirmation */}
      <ConfirmDialog
        isOpen={statusConfirmOpen}
        title={
          owner.status === "active" ? "Deactivate Owner" : "Activate Owner"
        }
        description={
          owner.status === "active"
            ? `Deactivate "${owner.name}"? They will no longer be treated as an active owner.`
            : `Activate "${owner.name}"? They will be available for active unit and payout workflows.`
        }
        confirmLabel={
          owner.status === "active" ? "Deactivate owner" : "Activate owner"
        }
        variant={owner.status === "active" ? "danger" : "primary"}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusConfirmOpen(false)}
      />
    </div>
  );
}
