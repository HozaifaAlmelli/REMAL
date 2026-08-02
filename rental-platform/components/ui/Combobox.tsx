"use client";

import { useState, useMemo, useRef, useEffect, useId } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SelectOption } from "./Select";

export interface ComboboxProps<T = string | number> {
  label?: string;
  error?: string;
  options: SelectOption<T>[];
  value?: T | null;
  onChange: (value: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export function Combobox<T = string | number>({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  searchable = true,
}: ComboboxProps<T>) {
  const controlId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const lowerQuery = query.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(lowerQuery)
    );
  }, [options, query, searchable]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear query when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  const handleSelect = (selectedValue: T) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const handleClear = () => {
    if (!disabled) {
      onChange(null);
    }
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={controlId}
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <button
          id={controlId}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={cn(
            "flex h-[var(--portal-control-height)] w-full items-center justify-between rounded-[var(--portal-radius-control)] border px-3.5 text-start text-sm",
            "bg-white transition-colors duration-150",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500",
            disabled
              ? "cursor-not-allowed bg-neutral-50 text-neutral-400"
              : "text-neutral-800",
            error ? "border-error focus:ring-error" : "border-neutral-300"
          )}
        >
          <span
            className={cn("truncate", !selectedOption && "text-neutral-500")}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex shrink-0 items-center">
            {value !== null && value !== undefined && !disabled && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="me-2 grid h-5 w-5 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Clear selection"
              >
                <X aria-hidden="true" size={14} />
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              size={15}
              className="text-neutral-400"
            />
          </div>
        </button>

        {isOpen && (
          <div className="ring-neutral-900/5 absolute left-0 right-0 top-full z-[80] mt-1 flex max-h-60 w-full flex-col overflow-hidden rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white shadow-xl ring-1 focus:outline-none">
            {searchable && (
              <div className="sticky top-0 shrink-0 border-b border-neutral-200 bg-white p-2">
                <input
                  type="text"
                  className="w-full rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            )}

            <div className="overflow-auto bg-white py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-neutral-400">
                  No results found
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <div
                    key={String(opt.value)}
                    onClick={() => {
                      if (!opt.disabled) {
                        handleSelect(opt.value);
                      }
                    }}
                    className={cn(
                      "cursor-pointer px-3 py-2 text-sm text-neutral-800 transition-colors",
                      opt.disabled
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-neutral-100",
                      selectedOption?.value === opt.value &&
                        "bg-primary-50 text-primary-700"
                    )}
                  >
                    {opt.label}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
    </div>
  );
}
