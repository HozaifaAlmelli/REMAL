import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsService } from "@/lib/api/services/clients.service";
import { queryKeys } from "@/lib/utils/query-keys";
import { toastSuccess, toastError } from "@/lib/utils/toast";
import { ApiError } from "@/lib/api/api-error";
import type {
  ClientListFilters,
  UpdateClientStatusRequest,
  ResetClientPasswordRequest,
  CreateClientRequest,
} from "@/lib/types";

export function useClients(
  filters?: ClientListFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.clients.list(filters),
    queryFn: () => clientsService.getAll(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => clientsService.getById(id),
    enabled: !!id,
  });
}

// Alias for backward compatibility
export function useClientDetail(id: string) {
  return useClient(id);
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateClientRequest) => clientsService.create(data),
    onSuccess: (client) => {
      toastSuccess(`Client "${client.name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        // Check if it's a duplicate phone error
        if (
          error.status === 409 ||
          error.message.toLowerCase().includes("phone")
        ) {
          toastError("This phone number is already registered");
        } else if (error.status === 400) {
          // Show validation errors
          if (error.errors && error.errors.length > 0) {
            toastError(error.errors.join(", "));
          } else {
            toastError(error.message || "Invalid client data");
          }
        } else {
          toastError(error.message || "Failed to create client");
        }
      } else {
        toastError("Failed to create client. Please try again.");
      }
    },
  });
}

export function useUpdateClientStatus(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateClientStatusRequest) =>
      clientsService.updateStatus(id, data),
    onSuccess: (client) => {
      toastSuccess(
        client.isActive ? "Client reactivated" : "Client deactivated"
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(id),
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        toastError(error.message || "Failed to update client status");
      } else {
        toastError("Failed to update client status. Please try again.");
      }
    },
  });
}

export function useResetClientPassword(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ResetClientPasswordRequest) =>
      clientsService.resetPassword(id, data),
    onSuccess: () => {
      toastSuccess("Client password reset");
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(id),
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        toastError(error.message || "Failed to reset client password");
      } else {
        toastError("Failed to reset client password. Please try again.");
      }
    },
  });
}
