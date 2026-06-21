"use client";

import { Pencil, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/lib/hooks/usePermissions";
import type { OwnerDetailsResponse } from "@/lib/types/owner.types";

export interface OwnerDetailHeaderProps {
  owner: OwnerDetailsResponse;
  onEdit: () => void;
  onChangeStatus: () => void;
  isLoading?: boolean;
}

export function OwnerDetailHeader({
  owner,
  onEdit,
  onChangeStatus,
  isLoading = false,
}: OwnerDetailHeaderProps) {
  const { canManageOwners } = usePermissions();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      {/* Left: title + meta badges */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            {owner.name}
          </h1>
          <Badge variant={owner.status === "active" ? "success" : "neutral"}>
            {owner.status === "active" ? "Active" : "Inactive"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-500">
          <span>
            Phone:{" "}
            <span className="font-medium text-neutral-700">{owner.phone}</span>
          </span>
          {owner.emergencyPhone && (
            <span>
              Emergency:{" "}
              <span className="font-medium text-neutral-700">
                {owner.emergencyPhone}
              </span>
            </span>
          )}
          {owner.email && (
            <span>
              Email:{" "}
              <span className="font-medium text-neutral-700">
                {owner.email}
              </span>
            </span>
          )}
          <span>
            Commission Rate:{" "}
            <span className="font-medium text-neutral-700">
              {Math.round(owner.commissionRate)}%
            </span>
          </span>
        </div>
      </div>

      {/* Right: action buttons */}
      {canManageOwners && (
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={isLoading}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit Owner
          </Button>

          <Button
            variant={owner.status === "active" ? "danger" : "primary"}
            size="sm"
            onClick={onChangeStatus}
            disabled={isLoading}
          >
            {owner.status === "active" ? (
              <>
                <PowerOff className="mr-1.5 h-4 w-4" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="mr-1.5 h-4 w-4" />
                Activate
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
