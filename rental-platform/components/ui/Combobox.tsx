"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SelectOption } from "./Select";

export interface ComboboxProps<T = string | number> {
  id?: string;
  label?: string;
  error?: string;
  options: SelectOption<T>[];
  value?: T | null;
  onChange: (value: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  required?: boolean;
}

export function Combobox<T = string | number>({
  id: providedId,
  label,
  error,
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  searchable = true,
  required = false,
}: ComboboxProps<T>) {
  const generatedId = useId();
  const controlId = providedId ?? `combobox-${generatedId}`;
  const listboxId = `${controlId}-listbox`;
  const searchId = `${controlId}-search`;
  const errorId = `${controlId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return options.filter((option) =>
      option.label.toLocaleLowerCase().includes(normalizedQuery)
    );
  }, [options, query, searchable]);

  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const firstEnabledIndex = () =>
    filteredOptions.findIndex((option) => !option.disabled);
  const lastEnabledIndex = () => {
    for (let index = filteredOptions.length - 1; index >= 0; index -= 1) {
      if (!filteredOptions[index]?.disabled) return index;
    }
    return -1;
  };

  const setInitialActiveOption = () => {
    const selectedIndex = filteredOptions.findIndex(
      (option) => option.value === value && !option.disabled
    );
    setActiveIndex(
      selectedIndex >= 0 ? selectedIndex : firstEnabledIndex()
    );
  };

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
    setInitialActiveOption();
  };

  const close = (restoreFocus = false) => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!isOpen || !searchable) return;
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = filteredOptions.findIndex(
      (option) => option.value === value && !option.disabled
    );
    setActiveIndex((current) => {
      if (current >= 0 && filteredOptions[current] && !filteredOptions[current]?.disabled)
        return current;
      return selectedIndex >= 0
        ? selectedIndex
        : filteredOptions.findIndex((option) => !option.disabled);
    });
  }, [filteredOptions, isOpen, value]);

  useEffect(() => {
    const handlePointerOutside = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("pointerdown", handlePointerOutside);
    return () =>
      document.removeEventListener("pointerdown", handlePointerOutside);
  }, []);

  const moveActive = (direction: 1 | -1) => {
    if (filteredOptions.length === 0) return;
    let next = activeIndex;
    for (let attempts = 0; attempts < filteredOptions.length; attempts += 1) {
      next =
        next < 0
          ? direction === 1
            ? 0
            : filteredOptions.length - 1
          : (next + direction + filteredOptions.length) %
            filteredOptions.length;
      if (!filteredOptions[next]?.disabled) {
        setActiveIndex(next);
        document
          .getElementById(optionId(next))
          ?.scrollIntoView({ block: "nearest" });
        return;
      }
    }
  };

  const selectActive = () => {
    const option = filteredOptions[activeIndex];
    if (!option || option.disabled) return;
    onChange(option.value);
    close(true);
  };

  const handleNavigationKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        close(true);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) open();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (!isOpen) return;
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex());
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(lastEnabledIndex());
    } else if (
      event.key === "Enter" ||
      (event.key === " " && (!searchable || query.length === 0))
    ) {
      event.preventDefault();
      selectActive();
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
          {required && <span className="ms-1 text-error">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          id={controlId}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          onClick={() => (isOpen ? close() : open())}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !isOpen) {
              event.preventDefault();
              open();
              return;
            }
            handleNavigationKey(event);
          }}
          className={cn(
            "flex h-[var(--portal-control-height)] w-full items-center justify-between rounded-[var(--portal-radius-control)] border px-3.5 text-start text-sm",
            "bg-white transition-colors duration-150",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500",
            selectedOption && !disabled && "pe-16",
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
          <ChevronDown
            aria-hidden
            size={15}
            className="shrink-0 text-neutral-400"
          />
        </button>

        {selectedOption && !disabled && (
          <button
            type="button"
            aria-label={`Clear ${label ?? "selection"}`}
            onClick={() => {
              onChange(null);
              triggerRef.current?.focus();
            }}
            className="absolute end-8 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <X aria-hidden size={14} />
          </button>
        )}

        {isOpen && (
          <div className="absolute inset-x-0 top-full z-[80] mt-1 flex max-h-60 flex-col overflow-hidden rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white shadow-xl ring-1 ring-neutral-900/5">
            {searchable && (
              <div className="sticky top-0 shrink-0 border-b border-neutral-200 bg-white p-2">
                <label htmlFor={searchId} className="sr-only">
                  Search {label ?? "options"}
                </label>
                <input
                  ref={searchRef}
                  id={searchId}
                  type="search"
                  role="searchbox"
                  aria-label={`Search ${label ?? "options"}`}
                  aria-controls={listboxId}
                  aria-activedescendant={
                    activeIndex >= 0 ? optionId(activeIndex) : undefined
                  }
                  className="w-full rounded-[var(--portal-radius-control)] border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Search..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleNavigationKey}
                />
              </div>
            )}

            <div
              id={listboxId}
              role="listbox"
              aria-label={label ?? "Options"}
              className="overflow-auto bg-white py-1"
            >
              {filteredOptions.length === 0 ? (
                <div role="status" className="px-3 py-2 text-sm text-neutral-500">
                  No results found
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <div
                    key={String(option.value)}
                    id={optionId(index)}
                    role="option"
                    aria-selected={selectedOption?.value === option.value}
                    aria-disabled={option.disabled || undefined}
                    onMouseMove={() => {
                      if (!option.disabled) setActiveIndex(index);
                    }}
                    onClick={() => {
                      if (!option.disabled) {
                        onChange(option.value);
                        close(true);
                      }
                    }}
                    className={cn(
                      "px-3 py-2 text-sm text-neutral-800 transition-colors",
                      option.disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:bg-neutral-100",
                      selectedOption?.value === option.value &&
                        "bg-primary-50 text-primary-700",
                      activeIndex === index &&
                        !option.disabled &&
                        "bg-neutral-100 outline-none"
                    )}
                  >
                    {option.label}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
