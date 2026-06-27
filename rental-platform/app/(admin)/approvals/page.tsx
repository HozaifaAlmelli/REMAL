"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { DateBlockApprovalCard } from "@/components/admin/approvals/DateBlockApprovalCard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { ROUTES } from "@/lib/constants/routes";
import {
  useDateBlockApprovals,
  useResolveDateBlock,
} from "@/lib/hooks/useDateBlockApprovals";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { toastError, toastSuccess } from "@/lib/utils/toast";
import type { DateBlockApprovalItem } from "@/lib/types/unit.types";

export default function DateBlockApprovalsPage() {
  const router = useRouter();
  const { canApproveBlocks } = usePermissions();
  const [rejectingItem, setRejectingItem] =
    useState<DateBlockApprovalItem | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const {
    data: approvals = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useDateBlockApprovals({ enabled: canApproveBlocks });
  const resolveBlock = useResolveDateBlock();

  useEffect(() => {
    if (canApproveBlocks === false) {
      router.replace(ROUTES.admin.dashboard);
    }
  }, [canApproveBlocks, router]);

  if (canApproveBlocks === false) {
    return null;
  }

  const handleApprove = (item: DateBlockApprovalItem) => {
    resolveBlock.mutate(
      {
        id: item.id,
        data: { decision: "approved" },
      },
      {
        onSuccess: () => toastSuccess("Date-block request approved"),
        onError: (error: unknown) =>
          toastError(
            error instanceof Error
              ? error.message
              : "Could not approve date-block request"
          ),
      }
    );
  };

  const handleReject = () => {
    if (!rejectingItem) return;

    resolveBlock.mutate(
      {
        id: rejectingItem.id,
        data: {
          decision: "rejected",
          notes: rejectNotes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toastSuccess("Date-block request rejected");
          setRejectingItem(null);
          setRejectNotes("");
        },
        onError: (error: unknown) =>
          toastError(
            error instanceof Error
              ? error.message
              : "Could not reject date-block request"
          ),
      }
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Availability approvals
          </h1>
          <p className="max-w-[72ch] text-sm text-neutral-600">
            Review owner date-block requests that overlap active pipeline records.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          isLoading={isFetching && !isLoading}
        >
          Refresh
        </Button>
      </div>

      {isError && (
        <div className="flex items-center justify-between rounded-[var(--portal-radius-card)] border border-error-bg bg-error-bg p-4 text-error">
          <p className="text-sm">
            We could not load the approval queue. Retry to refresh the list.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-[var(--portal-radius-card)]" />
          <Skeleton className="h-40 w-full rounded-[var(--portal-radius-card)]" />
        </div>
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-8 w-8" />}
          title="No pending approvals"
          description="Owner date-block requests that need review will appear here."
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((item) => (
            <DateBlockApprovalCard
              key={item.id}
              item={item}
              isResolving={resolveBlock.isPending}
              onApprove={handleApprove}
              onReject={setRejectingItem}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!rejectingItem}
        title="Reject date-block request"
        description="Rejecting frees these dates immediately."
        confirmLabel="Reject request"
        variant="danger"
        isLoading={resolveBlock.isPending}
        onConfirm={handleReject}
        onCancel={() => {
          if (resolveBlock.isPending) return;
          setRejectingItem(null);
          setRejectNotes("");
        }}
      >
        <Textarea
          label="Reason"
          value={rejectNotes}
          onChange={(event) => setRejectNotes(event.target.value)}
          rows={3}
          placeholder="Optional note for the owner"
          disabled={resolveBlock.isPending}
        />
      </ConfirmDialog>
    </div>
  );
}
