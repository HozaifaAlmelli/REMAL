"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}

export interface ModalFooterProps {
  children: React.ReactNode;
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

// Animation variants with reduced motion support
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
};

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
      {children}
    </div>
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Portal mount handling
  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Check for reduced motion preference
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Keep a stable ref to onClose so the effect doesn't re-run on every render
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape key, scroll lock, and focus trap
  React.useEffect(() => {
    if (!isOpen || !mounted) return;

    // Save previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("overflow-hidden");

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("overflow-hidden");
      previousFocusRef.current?.focus();
    };
  }, [isOpen, mounted]);

  if (!mounted) return null;

  const transitionConfig = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: "easeOut" };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <motion.div
            aria-hidden="true"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transitionConfig}
            className="bg-neutral-900/60 absolute inset-0 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Modal Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transitionConfig}
            className={cn(
              "relative z-10 w-full rounded-2xl bg-white shadow-2xl",
              "max-h-[90vh] overflow-hidden",
              sizeClasses[size]
            )}
            onClick={(event) => event.stopPropagation()}
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              {title ? (
                <h2
                  id="modal-title"
                  className="text-base font-semibold text-neutral-800"
                >
                  {title}
                </h2>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Close modal"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[calc(90vh-64px)] overflow-y-auto px-6 py-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// Compound component pattern
Modal.Footer = ModalFooter;
Modal.displayName = "Modal";
ModalFooter.displayName = "Modal.Footer";
