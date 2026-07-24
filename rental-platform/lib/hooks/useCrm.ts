import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { crmService } from "@/lib/api/services/crm.service";
import { ApiError } from "@/lib/api/api-error";
import { queryKeys } from "@/lib/utils/query-keys";
import { ROUTES } from "@/lib/constants/routes";
import { toastSuccess, toastError } from "@/lib/utils";
import {
  CRM_LEAD_STATUSES,
  CRM_STATUS_LABELS,
} from "@/lib/constants/booking-statuses";
import { normalizeStatus } from "@/lib/utils/status";
import type {
  CrmLeadStatus,
  CrmLeadListItemResponse,
  CreateCrmLeadRequest,
  ConvertLeadToBookingRequest,
  UpdateCrmLeadStatusRequest,
  AddLeadNoteRequest,
  UpdateCrmNoteRequest,
  AssignLeadRequest,
} from "@/lib/types/crm.types";

const CRM_LEADS_PAGE_SIZE = 100;

export function useLeadsPipeline(enabled = true) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.crm.leads(),
    queryFn: ({ pageParam }) =>
      crmService.getLeads({
        page: pageParam,
        pageSize: CRM_LEADS_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true, // sales switches between windows
    enabled,
  });

  // De-duplicate by id so records created during incremental loading cannot
  // appear twice when a server page boundary shifts.
  const leads = useMemo(
    () =>
      Array.from(
        new Map(
          (query.data?.pages ?? [])
            .flatMap((page) => page.items)
            .map((lead) => [lead.id, lead])
        ).values()
      ),
    [query.data?.pages]
  );

  const groupedLeads = useMemo(() => {
    return leads.reduce(
      (acc, lead) => {
        const normalizedStatus = normalizeStatus(lead.leadStatus);
        if (
          !Object.values(CRM_LEAD_STATUSES).includes(
            normalizedStatus as CrmLeadStatus
          )
        ) {
          return acc;
        }

        const status = normalizedStatus as CrmLeadStatus;
        if (!acc[status]) acc[status] = [];
        acc[status].push(lead);
        return acc;
      },
      {} as Record<CrmLeadStatus, CrmLeadListItemResponse[]>
    );
  }, [leads]);

  // Open-lead count is intentionally NOT derived here: the pipeline fetch is page-capped
  // and would undercount. The authoritative count comes from the server via
  // useOpenLeadsCount() (GET /api/internal/crm/leads/open-count) — single source of truth.
  return {
    leads,
    groupedLeads,
    totalCount: query.data?.pages[0]?.pagination.totalCount ?? 0,
    loadedCount: leads.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useOpenLeadsCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.crm.openCount(),
    queryFn: crmService.getOpenLeadCount,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useLeadDetail(leadId: string) {
  return useQuery({
    queryKey: queryKeys.crm.leadDetail(leadId),
    queryFn: () => crmService.getLeadById(leadId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCrmLeadRequest) => crmService.createLead(data),
    onSuccess: () => {
      toastSuccess("Lead created successfully");
      queryClient.refetchQueries({ queryKey: queryKeys.crm.leads() });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.openCount() });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        // Check for specific error types
        if (
          error.status === 409 ||
          error.message.toLowerCase().includes("phone")
        ) {
          toastError("This phone number already has a lead");
        } else if (error.status === 400) {
          // Show validation errors
          if (error.errors && error.errors.length > 0) {
            toastError(error.errors.join(", "));
          } else {
            toastError(error.message || "Invalid lead data");
          }
        } else {
          toastError(error.message || "Failed to create lead");
        }
      } else {
        toastError("Failed to create lead. Please try again.");
      }
    },
  });
}

export function useUpdateLeadStatus(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCrmLeadStatusRequest) =>
      crmService.updateLeadStatus(leadId, data),
    onSuccess: (updatedLead) => {
      toastSuccess(
        `Lead moved to ${CRM_STATUS_LABELS[updatedLead.leadStatus]}`
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadDetail(leadId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads() });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.openCount() });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        toastError(error.message || "Failed to update lead status");
      } else {
        toastError("Failed to update lead status. Please try again.");
      }
    },
  });
}

export function useConvertToBooking(leadId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: ConvertLeadToBookingRequest) =>
      crmService.convertToBooking(leadId, data),
    onSuccess: (booking) => {
      toastSuccess("Lead successfully converted to booking");
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadDetail(leadId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads() });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.openCount() });
      router.push(ROUTES.admin.bookings.detail(booking.id));
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? (error.errors[0] ?? error.message)
          : "Failed to convert lead to booking. Please try again.";
      toastError(message);
    },
  });
}

export function useLeadNotes(leadId: string) {
  return useQuery({
    queryKey: queryKeys.crm.leadNotes(leadId),
    queryFn: () => crmService.getLeadNotes(leadId),
  });
}

export function useAddLeadNote(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddLeadNoteRequest) =>
      crmService.addLeadNote(leadId, data),
    onSuccess: () => {
      toastSuccess("Note added");
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadNotes(leadId),
      });
    },
  });
}

export function useUpdateCrmNote(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      noteId,
      data,
    }: {
      noteId: string;
      data: UpdateCrmNoteRequest;
    }) => crmService.updateNote(noteId, data),
    onSuccess: () => {
      toastSuccess("Note updated");
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadNotes(leadId),
      });
    },
  });
}

export function useDeleteCrmNote(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => crmService.deleteNote(noteId),
    onSuccess: () => {
      toastSuccess("Note deleted");
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadNotes(leadId),
      });
    },
  });
}

export function useLeadAssignment(leadId: string) {
  return useQuery({
    queryKey: queryKeys.crm.leadAssignment(leadId),
    queryFn: async () => {
      try {
        return await crmService.getLeadAssignment(leadId);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) {
          return null; // No assignment yet — treat as Unassigned
        }
        throw err;
      }
    },
    retry: false,
  });
}

export function useAssignableAdmins(enabled = true) {
  return useQuery({
    queryKey: queryKeys.crm.assignees(),
    queryFn: crmService.getAssignees,
    enabled,
  });
}

export function useAssignLead(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignLeadRequest) =>
      crmService.assignLead(leadId, data),
    onSuccess: () => {
      toastSuccess("Lead assigned");
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadAssignment(leadId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadDetail(leadId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads() });
    },
  });
}

export function useUnassignLead(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => crmService.unassignLead(leadId),
    onSuccess: () => {
      toastSuccess("Lead unassigned");
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadAssignment(leadId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.crm.leadDetail(leadId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads() });
    },
  });
}
