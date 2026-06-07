"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth.store";
import { ROUTES } from "@/lib/constants/routes";
import { OwnerSidebar } from "@/components/owner/layout/OwnerSidebar";
import { OwnerHeader } from "@/components/owner/layout/OwnerHeader";
import { authService } from "@/lib/api/services/auth.service";
import { PortalSplash, usePortalReady } from "@/components/ui/PortalSplash";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { subjectType, accessToken, setAuth, clearAuth } = useAuthStore();
  // Start ready only if we already have a token in memory (in-app navigation).
  // On cold start (page refresh) the token is null until refresh completes.
  const [isAuthReady, setIsAuthReady] = useState(!!accessToken);
  // Keep the branded handoff visible briefly so it's seen after sign-in.
  const showApp = usePortalReady(isAuthReady && subjectType === "Owner");

  useEffect(() => {
    if (subjectType !== "Owner") {
      router.replace(ROUTES.auth.ownerLogin);
      return;
    }

    if (accessToken) {
      // Token already in memory — no refresh needed.
      setIsAuthReady(true);
      return;
    }

    // Cold start: access token was not persisted. Proactively refresh via
    // the HttpOnly refresh cookie before any authenticated queries fire,
    // so queries never receive a 401 on initial page load.
    authService
      .refresh()
      .then((auth) => {
        if (!auth || auth.subjectType !== "Owner") {
          clearAuth();
          router.replace(ROUTES.auth.ownerLogin);
          return;
        }

        setAuth({
          accessToken: auth.accessToken,
          expiresInSeconds: auth.expiresInSeconds,
          subjectType: auth.subjectType,
          user: auth.user,
          role: "Owner",
        });
      })
      .catch(() => {
        clearAuth();
        router.replace(ROUTES.auth.ownerLogin);
      })
      .finally(() => {
        setIsAuthReady(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!showApp) {
    return <PortalSplash className="portal-owner" label="Loading your dashboard" />;
  }

  return (
    <div className="portal-owner content-density-balanced min-h-screen bg-neutral-50 text-neutral-700">
      <div className="flex min-h-screen">
        <OwnerSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <OwnerHeader />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
