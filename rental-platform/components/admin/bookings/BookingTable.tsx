"use client";

import * as React from "react";
import { formatCurrency, formatDate, getNights } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import type { BookingListItemResponse } from "@/lib/types/booking.types";
import { ROUTES } from "@/lib/constants/routes";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@/lib/api/types";

const maskPhone = (phone: string | undefined | null) => {
  if (!phone) return "-";
  if (phone.length < 4) return phone;
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
};

interface BookingTableProps {
  bookings: BookingListItemResponse[];
  isLoading: boolean;
  pagination?: PaginationMeta | null;
  onPageChange?: (page: number) => void;
}

export function BookingTable({
  bookings,
  isLoading,
  pagination,
  onPageChange,
}: BookingTableProps) {
  const columns: ColumnDef<BookingListItemResponse>[] = [
    {
      accessorKey: "clientId",
      header: "Client / Phone",
      cell: ({ row }) => {
        let isToday = false;
        if (row.original.checkInDate) {
          const today = new Date().toISOString().split("T")[0];
          const checkIn = new Date(row.original.checkInDate)
            .toISOString()
            .split("T")[0];
          isToday = today === checkIn;
        }

        return (
          <div className="relative pl-1">
            {isToday && (
              <div
                className="absolute inset-y-0 -left-5 w-1 rounded-r-md bg-amber-500"
                title="Checking in today"
              />
            )}
            <div
              className="max-w-[120px] truncate font-medium text-neutral-900 sm:max-w-full"
              title={row.original.clientId}
            >
              {row.original.clientId.split("-")[0]}...
            </div>
            <div className="mt-0.5 truncate text-xs text-neutral-500">
              {maskPhone(null)}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "unitId",
      header: "Unit",
      cell: ({ row }) => (
        <span
          className="font-medium text-neutral-900"
          title={row.original.unitId}
        >
          {row.original.unitId.split("-")[0]}...
        </span>
      ),
    },
    {
      accessorKey: "checkInDate",
      header: "Dates",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-neutral-900">
            {formatDate(row.original.checkInDate)}
          </span>
          <span className="text-xs text-neutral-500">
            {formatDate(row.original.checkOutDate)}
          </span>
        </div>
      ),
    },
    {
      id: "nights",
      header: "Nights",
      cell: ({ row }) => (
        <span className="text-neutral-600">
          {getNights(row.original.checkInDate, row.original.checkOutDate)}
        </span>
      ),
    },
    {
      accessorKey: "finalAmount",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-semibold text-neutral-900">
          {formatCurrency(row.original.finalAmount)}
        </span>
      ),
    },
    {
      accessorKey: "bookingStatus",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.bookingStatus} />,
    },
    {
      accessorKey: "assignedAdminUserId",
      header: "Assigned To",
      cell: ({ row }) => {
        const id = row.original.assignedAdminUserId;
        return (
          <span
            className="font-mono text-xs text-neutral-500"
            title={id || "Unassigned"}
          >
            {id ? `${id.split("-")[0]}...` : "Unassigned"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Link href={ROUTES.admin.bookings.detail(row.original.id)}>
            <Button variant="secondary" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={bookings}
      isLoading={isLoading}
      emptyMessage="No bookings match current filters"
      pagination={pagination || undefined}
      onPageChange={onPageChange}
    />
  );
}
