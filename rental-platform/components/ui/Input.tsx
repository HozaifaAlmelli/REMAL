"use client";
import { InputHTMLAttributes, ReactNode, forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftAddon,
      rightAddon,
      className,
      id: providedId,
      "aria-describedby": describedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-help`;
    const descriptionId = [describedBy, error ? errorId : helperText ? helperId : null]
      .filter(Boolean)
      .join(" ") || undefined;

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

        <div className="relative flex items-center">
          {leftAddon && (
            <div className="pointer-events-none absolute start-3 text-neutral-400">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={descriptionId}
            className={cn(
              "w-full rounded-[var(--portal-radius-control)] border bg-white text-sm text-neutral-800",
              "h-[var(--portal-control-height)] px-3.5",
              "placeholder:text-neutral-400",
              "transition-colors duration-150",
              "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500",
              "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
              error ? "border-error focus:ring-error" : "border-neutral-300",
              leftAddon && "ps-10",
              rightAddon && "pe-10",
              className
            )}
            {...props}
          />

          {rightAddon && (
            <div className="absolute end-3 text-neutral-400">{rightAddon}</div>
          )}
        </div>

        {error && <p id={errorId} className="mt-1.5 text-xs text-error">{error}</p>}
        {!error && helperText && (
          <p id={helperId} className="mt-1.5 text-xs text-neutral-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
