"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PaginationMeta } from "@/lib/api/types";

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function Pagination({
  meta,
  onPageChange,
  isLoading = false,
  className,
}: PaginationProps) {
  const { page, totalPages, totalCount, pageSize } = meta;

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--portal-radius-card)] border border-neutral-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-sm text-neutral-600">
        Showing {startItem}–{endItem} of {totalCount} results
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--portal-radius-control)] border border-neutral-200 px-3 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={16} />
          Prev
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            disabled={isLoading}
            className={cn(
              "inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--portal-radius-control)] border px-3 text-sm transition-colors",
              p === page
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            )}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--portal-radius-control)] border border-neutral-200 px-3 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
