"use client";

import * as React from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { OwnerListFilters } from "@/lib/types/owner.types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";

interface OwnerFiltersProps {
  filters: OwnerListFilters;
  onChange: (filters: OwnerListFilters) => void;
  isFetching: boolean;
}

const SEARCH_DEBOUNCE_MS = 350;

export function OwnerFilters({
  filters,
  onChange,
  isFetching,
}: OwnerFiltersProps) {
  const [search, setSearch] = React.useState(filters.search ?? "");

  React.useEffect(() => {
    setSearch(filters.search ?? "");
  }, [filters.search]);

  const emit = React.useCallback(
    (next: Partial<OwnerListFilters>) => {
      onChange({
        ...filters,
        ...next,
        page: 1,
      });
    },
    [filters, onChange]
  );

  React.useEffect(() => {
    const normalizedSearch = search.trim() || undefined;
    if (normalizedSearch === filters.search) return;

    const timeoutId = window.setTimeout(() => {
      emit({ search: normalizedSearch });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [emit, filters.search, search]);

  const handleIncludeInactiveToggle = (checked: boolean) => {
    emit({ includeInactive: checked });
  };

  const clearFilters = () => {
    setSearch("");
    onChange({
      page: 1,
      pageSize: filters.pageSize,
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_auto_auto] sm:items-end">
      <Input
        label="Search"
        placeholder="Name, phone, emergency phone, email"
        value={search}
        leftAddon={<Search className="h-4 w-4" />}
        rightAddon={
          isFetching ? (
            <LoaderCircle
              className="h-4 w-4 animate-spin"
              aria-label="Updating results"
            />
          ) : search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="rounded p-0.5 text-neutral-400 transition-colors hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <X className="h-4 w-4" />
            </button>
          ) : undefined
        }
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="flex h-[var(--portal-control-height)] items-center gap-2">
        <Switch
          id="include-inactive"
          checked={filters.includeInactive ?? false}
          onCheckedChange={handleIncludeInactiveToggle}
          disabled={isFetching}
        />
        <Label htmlFor="include-inactive" className="text-sm text-neutral-700">
          Include inactive
        </Label>
      </div>

      <Button
        type="button"
        variant="ghost"
        disabled={!filters.search && !filters.includeInactive && !search}
        onClick={clearFilters}
        leftIcon={<X className="h-4 w-4" />}
      >
        Clear
      </Button>
    </div>
  );
}
