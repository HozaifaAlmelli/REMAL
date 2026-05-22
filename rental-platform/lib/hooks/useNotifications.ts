// ──────────────────────────────────────────────────────────────────────────────
// Notifications Hooks
// From REMAL_API_Reference.md Sections 30-33
// Verified against P25, P26, P27
// ──────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "../api/services/notifications.service";
import { queryKeys } from "./query-keys";
import type {
  UpsertNotificationPreferenceRequest,
  CreateAdminNotificationRequest,
  CreateClientNotificationRequest,
  CreateOwnerNotificationRequest,
} from "../types/notification.types";

// ── Admin Inbox ──

export function useAdminNotificationInbox() {
  return useQuery({
    queryKey: queryKeys.notifications.adminInbox(),
    queryFn: () => notificationsService.getAdminInbox(),
    staleTime: 0, // always fresh — notifications change frequently
  });
}

export function useAdminNotificationSummary() {
  return useQuery({
    queryKey: queryKeys.notifications.adminInboxSummary(),
    queryFn: () => notificationsService.getAdminSummary(),
    refetchInterval: 1000 * 60 * 2, // poll every 2 minutes for bell badge
    staleTime: 0,
    retry: false,
  });
}

export function useMarkAdminNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsService.markAdminRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.adminInbox(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.adminInboxSummary(),
      });
    },
  });
}

export function useMarkAllAdminNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllAdminRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.adminInbox(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.adminInboxSummary(),
      });
    },
  });
}

// ── Admin Preferences ──

export function useAdminNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notifications.adminPreferences(),
    queryFn: () => notificationsService.getAdminPreferences(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateAdminNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertNotificationPreferenceRequest) =>
      notificationsService.updateAdminPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.adminPreferences(),
      });
    },
  });
}

// ── Owner Inbox (for Wave 6) ──

export function useOwnerNotificationInbox() {
  return useQuery({
    queryKey: queryKeys.notifications.ownerInbox(),
    queryFn: () => notificationsService.getOwnerInbox(),
    staleTime: 0,
  });
}

export function useOwnerNotificationSummary() {
  return useQuery({
    queryKey: queryKeys.notifications.ownerInboxSummary(),
    queryFn: () => notificationsService.getOwnerSummary(),
    refetchInterval: 1000 * 60 * 2,
    staleTime: 0,
    retry: false,
  });
}

export function useMarkOwnerNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsService.markOwnerRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.ownerInbox(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.ownerInboxSummary(),
      });
    },
  });
}

export function useMarkAllOwnerNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllOwnerRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.ownerInbox(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.ownerInboxSummary(),
      });
    },
  });
}

// ── Owner Preferences (for Wave 6) ──

export function useOwnerNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notifications.ownerPreferences(),
    queryFn: () => notificationsService.getOwnerPreferences(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateOwnerNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertNotificationPreferenceRequest) =>
      notificationsService.updateOwnerPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.ownerPreferences(),
      });
    },
  });
}

// ── Client Inbox (for Wave 7) ──

export function useClientNotificationInbox() {
  return useQuery({
    queryKey: queryKeys.notifications.clientInbox(),
    queryFn: () => notificationsService.getClientInbox(),
    staleTime: 0,
  });
}

export function useClientNotificationSummary() {
  return useQuery({
    queryKey: queryKeys.notifications.clientInboxSummary(),
    queryFn: () => notificationsService.getClientSummary(),
    refetchInterval: 1000 * 60 * 2,
    staleTime: 0,
    retry: false,
  });
}

export function useMarkClientNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsService.markClientRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.clientInbox(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.clientInboxSummary(),
      });
    },
  });
}

// ── Client Preferences (for Wave 7) ──

export function useClientNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notifications.clientPreferences(),
    queryFn: () => notificationsService.getClientPreferences(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateClientNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertNotificationPreferenceRequest) =>
      notificationsService.updateClientPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.clientPreferences(),
      });
    },
  });
}

// ── Dispatch (admin sends to users) ──

export function useSendAdminNotification() {
  return useMutation({
    mutationFn: ({
      adminUserId,
      data,
    }: {
      adminUserId: string;
      data: CreateAdminNotificationRequest;
    }) => notificationsService.sendToAdmin(adminUserId, data),
  });
}

export function useSendClientNotification() {
  return useMutation({
    mutationFn: ({
      clientId,
      data,
    }: {
      clientId: string;
      data: CreateClientNotificationRequest;
    }) => notificationsService.sendToClient(clientId, data),
  });
}

export function useSendOwnerNotification() {
  return useMutation({
    mutationFn: ({
      ownerId,
      data,
    }: {
      ownerId: string;
      data: CreateOwnerNotificationRequest;
    }) => notificationsService.sendToOwner(ownerId, data),
  });
}
