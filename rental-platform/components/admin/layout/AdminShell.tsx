"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth.store";
import { authService } from "@/lib/api/services/auth.service";
import { ROUTES } from "@/lib/constants/routes";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { PortalSplash, usePortalReady } from "@/components/ui/PortalSplash";

/**
 * AdminShell — client component that owns the admin layout chrome.
 *
 * On first render the access token is always null (not persisted for security).
 * We proactively call the refresh endpoint BEFORE mounting any child that may
 * issue API calls, so no child ever sees a 401 on its first request.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const subjectType = useAuthStore((s) => s.subjectType);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [isReady, setIsReady] = useState(false);
  // Hold the branded handoff visible briefly so it's actually seen after
  // sign-in (the access token is already in memory, so auth resolves instantly).
  const showApp = usePortalReady(isReady);

  useEffect(() => {
    // Token already present (e.g. navigated client-side after login)
    if (accessToken) {
      if (subjectType !== "Admin") {
        const target =
          subjectType === "Owner"
            ? ROUTES.owner.dashboard
            : ROUTES.client.account;
        router.replace(target);
        return;
      }

      setIsReady(true);
      return;
    }

    // No token → try the refresh cookie before mounting any API-calling child
    authService
      .refresh()
      .then((auth) => {
        if (!auth) {
          router.replace(ROUTES.auth.adminLogin);
          return;
        }

        setAuth({
          accessToken: auth.accessToken,
          expiresInSeconds: auth.expiresInSeconds,
          subjectType: auth.subjectType,
          user: auth.user,
          role: auth.subjectType === "Admin" ? auth.adminRole : null,
          roleName: auth.roleName,
          permissions: auth.permissions,
        });

        if (auth.subjectType !== "Admin") {
          const target =
            auth.subjectType === "Owner"
              ? ROUTES.owner.dashboard
              : ROUTES.client.account;
          router.replace(target);
          return;
        }

        setIsReady(true);
      })
      .catch(() => {
        clearAuth();
        router.replace(ROUTES.auth.adminLogin);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, subjectType, router, setAuth, clearAuth]);

  if (!showApp) {
    return (
      <PortalSplash className="portal-admin" label="Loading your workspace" />
    );
  }

  return (
    <div className="portal-admin content-density-compact flex h-screen overflow-hidden bg-neutral-50 text-neutral-700">
      <AdminSidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminHeader />

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
