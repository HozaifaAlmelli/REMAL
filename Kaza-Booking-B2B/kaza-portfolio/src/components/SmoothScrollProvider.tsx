"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLang } from "@/context/LanguageContext";

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLang();

  // Unified Instance Setup (Runs once on root mount)
  useEffect(() => {
    // Force reset any stuck document styles before spinning up the engine
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      syncTouch: true // Normalizes performance across touchpads and mobile emulation
    });

    lenisRef.current = lenis;
    (window as any).lenis = lenis; // Support mobile navigation scroll lock

    // Direct binding into the GSAP rendering engine ticker
    function rafTicker(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(rafTicker);

    // Pipe scroll vectors straight to global tracking mechanisms
    lenis.on("scroll", ScrollTrigger.update);

    // Global Cleanup Lifecycle
    return () => {
      delete (window as any).lenis;
      lenis.destroy();
      gsap.ticker.remove(rafTicker);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      
      // Strict layout reset on teardown
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  // Radical Cache Reset Loop: Fires on EVERY navigation, search update, and language flip
  useLayoutEffect(() => {
    const handleGlobalRecalibration = () => {
      if (!lenisRef.current) return;

      // 1. Force the viewport target position directly to absolute zero
      lenisRef.current.scrollTo(0, { immediate: true });

      // 2. Clear out any inline styling artifacts lingering on global wrapper tags
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.documentElement.style.height = "auto";
      document.body.style.height = "auto";

      // 3. Command Lenis to run an internal container boundary check
      lenisRef.current.resize();

      // 4. Wipe internal layout memory parameters inside GSAP cache and rebuild matrix
      ScrollTrigger.refresh();
    };

    // Execute with a tiny micro-task delay to guarantee Next.js finished rendering the target DOM structure
    const timeoutId = setTimeout(handleGlobalRecalibration, 60);

    return () => clearTimeout(timeoutId);
  }, [pathname, searchParams, lang]);

  return <>{children}</>;
}