import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dateBlockApprovalsService } from "@/lib/api/services/date-block-approvals.service";
import { queryKeys } from "./query-keys";
import type { ResolveDateBlockRequest } from "@/lib/types/unit.types";

interface UseDateBlockApprovalsOptions {
  enabled?: boolean;
}

export function useDateBlockApprovals({
  enabled = true,
}: UseDateBlockApprovalsOptions = {}) {
  return useQuery({
    queryKey: queryKeys.dateBlockApprovals.list(),
    queryFn: dateBlockApprovalsService.getPending,
    enabled,
    staleTime: 0,
  });
}

export function useResolveDateBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ResolveDateBlockRequest;
    }) => dateBlockApprovalsService.resolve(id, data),
    onSuccess: (block) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dateBlockApprovals.all,
      });
      queryClient.invalidateQueries({
        queryKey: ["units", block.unitId, "availability"],
      });
      queryClient.invalidateQueries({
        queryKey: ["ownerPortal", "unitAvailability", block.unitId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ownerPortal", "units", "dateBlocks", block.unitId],
      });
    },
  });
}
