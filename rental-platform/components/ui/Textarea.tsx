"use client";
import { TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, helperText, rows = 4, className, id: providedId, ...props },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            {label}
            {props.required && <span className="ms-1 text-error">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={cn(
            "w-full rounded-[var(--portal-radius-control)] border bg-white text-sm text-neutral-800",
            "px-3.5 py-2.5",
            "placeholder:text-neutral-400",
            "transition-colors duration-150",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
            error ? "border-error focus:ring-error" : "border-neutral-300",
            className
          )}
          {...props}
        />

        {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
        {!error && helperText && (
          <p className="mt-1.5 text-xs text-neutral-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
