"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const internalPrefixes = ["/admin", "/owner", "/account", "/auth"];
    const isInternalRoute = internalPrefixes.some((prefix) =>
      pathname?.startsWith(prefix)
    );

    // Internal app shells use their own scroll containers; keep native wheel behavior there.
    if (isInternalRoute) {
      return;
    }

    // Check for touch devices
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (isTouchDevice || prefersReducedMotion) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
    });

    // Expose lenis globally for external hooks if needed
    window.__lenis = lenis;

    let rafId: number;

    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      delete window.__lenis;
    };
  }, [pathname]);

  return <>{children}</>;
}
