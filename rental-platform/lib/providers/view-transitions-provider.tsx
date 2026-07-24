"use client";

import {
  use,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type PendingViewTransition = readonly [Promise<void>, () => void];

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => Promise<void>) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

function reportUnexpectedTransitionError(error: unknown) {
  if (!(error instanceof DOMException && error.name === "AbortError")) {
    console.error("View transition failed", error);
  }
}

function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getHashSnapshot() {
  return window.location.hash;
}

function getServerHashSnapshot() {
  return "";
}

export function ViewTransitionsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const hash = useSyncExternalStore(
    subscribeToHash,
    getHashSnapshot,
    getServerHashSnapshot
  );
  const routeKey = `${pathname}${hash}`;
  const currentRouteKey = useRef(routeKey);
  const [pendingTransition, setPendingTransition] =
    useState<PendingViewTransition | null>(null);

  useEffect(() => {
    const transitionDocument = document as ViewTransitionDocument;
    if (!transitionDocument.startViewTransition) {
      return;
    }

    const onPopState = () => {
      const isQueryOnlyNavigation =
        currentRouteKey.current ===
        `${window.location.pathname}${window.location.hash}`;
      let finishTransition = () => {};
      const routeUpdated = new Promise<void>((resolve) => {
        finishTransition = resolve;
      });
      const transitionStarted = new Promise<void>((resolve) => {
        const transition = transitionDocument.startViewTransition?.(() => {
          resolve();
          return routeUpdated;
        });

        // A skipped visual transition must never turn successful navigation
        // into an unhandled browser error.
        transition?.ready.catch(reportUnexpectedTransitionError);
        transition?.updateCallbackDone.catch(reportUnexpectedTransitionError);
        transition?.finished.catch(reportUnexpectedTransitionError);
      });

      setPendingTransition([transitionStarted, finishTransition]);

      if (isQueryOnlyNavigation) {
        requestAnimationFrame(() => {
          requestAnimationFrame(finishTransition);
        });
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (pendingTransition && currentRouteKey.current !== routeKey) {
    use(pendingTransition[0]);
  }

  const pendingTransitionRef = useRef(pendingTransition);
  useEffect(() => {
    pendingTransitionRef.current = pendingTransition;
  }, [pendingTransition]);

  useEffect(() => {
    currentRouteKey.current = routeKey;
    if (pendingTransitionRef.current) {
      pendingTransitionRef.current[1]();
      pendingTransitionRef.current = null;
    }
  }, [routeKey]);

  return children;
}
