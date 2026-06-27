import api from "@/lib/api/axios";
import { endpoints } from "@/lib/api/endpoints";
import type {
  DateBlockApprovalItem,
  DateBlockResponse,
  ResolveDateBlockRequest,
} from "@/lib/types/unit.types";

export const dateBlockApprovalsService = {
  getPending: (): Promise<DateBlockApprovalItem[]> =>
    api.get(endpoints.dateBlocks.approvals),

  resolve: (
    id: string,
    data: ResolveDateBlockRequest
  ): Promise<DateBlockResponse> =>
    api.patch(endpoints.dateBlocks.resolve(id), data),
};
