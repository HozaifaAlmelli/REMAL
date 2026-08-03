"use client";

import { SelectHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T = string | number> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange"
> {
  label?: string;
  error?: string;
  options: SelectOption<T>[];
  placeholder?: string;
  onChange?: (value: T) => void;
}

export const Select = forwardRef<
  HTMLSelectElement,
  SelectProps<string | number>
>(
  (
    {
      label,
      error,
      options,
      placeholder,
      className,
      onChange,
      id: providedId,
      "aria-describedby": describedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value as unknown as string | number);
    };

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

        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedBy, error ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined}
          onChange={handleChange}
          className={cn(
            "h-[var(--portal-control-height)] w-full rounded-[var(--portal-radius-control)] border bg-white px-3.5 text-sm text-neutral-800",
            "transition-colors duration-150",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
            error ? "border-error focus:ring-error" : "border-neutral-300",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {options.map((opt) => (
            <option
              key={String(opt.value)}
              value={String(opt.value)}
              disabled={opt.disabled}
            >
              {opt.label}
            </option>
          ))}
        </select>

        {error && <p id={errorId} className="mt-1.5 text-xs text-error">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
