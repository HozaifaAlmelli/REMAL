"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { OwnerPortalBookingResponse } from "@/lib/types/owner-portal.types";
import { formatCurrency, referenceCode } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { HistoricalBadge } from "@/components/ui/HistoricalBadge";

interface OwnerBookingDetailProps {
  booking: OwnerPortalBookingResponse;
  /** Resolved from the owner's units list; falls back to a reference if absent. */
  unitName?: string;
}

export function OwnerBookingDetail({
  booking,
  unitName,
}: OwnerBookingDetailProps) {
  const [copied, setCopied] = useState(false);
  const reference = referenceCode("BKG", booking.bookingId);
  const checkInDate = new Date(booking.checkInDate);
  const checkOutDate = new Date(booking.checkOutDate);
  const createdAt = new Date(booking.createdAt);
  const updatedAt = new Date(booking.updatedAt);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const nightCount = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      {/* Status badge */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={booking.bookingStatus} />
        {booking.isHistorical && <HistoricalBadge />}
      </div>

      {booking.isHistorical && (
        <div className="border-y border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This Historical Booking records a past stay in KAZA. Owner payout status remains available only in the finance ledger.
        </div>
      )}

      {/* Stay details */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Stay Details</h2>
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-neutral-500">Unit</dt>
            <dd className="text-right font-medium text-neutral-900">
              {unitName ?? referenceCode("UNIT", booking.unitId)}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Check-in</dt>
            <dd className="font-medium text-neutral-900">
              {formatDate(checkInDate)}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Check-out</dt>
            <dd className="font-medium text-neutral-900">
              {formatDate(checkOutDate)}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Duration</dt>
            <dd className="font-medium text-neutral-900">
              {nightCount} {nightCount === 1 ? "night" : "nights"}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Guest Count</dt>
            <dd className="font-medium text-neutral-900">
              {booking.guestCount}{" "}
              {booking.guestCount === 1 ? "guest" : "guests"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Financial summary */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">
          Financial Summary
        </h2>
        <div className="mt-4">
          <p className="text-sm text-neutral-500">Final Amount</p>
          <p className="mt-1 text-3xl font-bold text-neutral-900">
            {formatCurrency(booking.finalAmount)}
          </p>
        </div>
      </div>

      {/* Booking metadata */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">
          Booking Information
        </h2>
        <dl className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-neutral-500">Reference</dt>
            <dd className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-medium text-neutral-700">
                {reference}
              </span>
              <button
                type="button"
                aria-label="Copy reference"
                title="Copy reference"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                onClick={async () => {
                  await navigator.clipboard.writeText(reference);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-neutral-500">Unit</dt>
            <dd className="text-right font-medium text-neutral-900">
              {unitName ?? referenceCode("UNIT", booking.unitId)}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">KAZA entry channel</dt>
            <dd className="font-medium text-neutral-900">
              {booking.isHistorical ? "Admin recording" : booking.source}
            </dd>
          </div>
        </dl>
      </div>

      {/* Timestamps */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap gap-6 text-xs text-neutral-500">
          <div>
            <span className="font-medium">Created:</span>{" "}
            {formatDateTime(createdAt)}
          </div>
          <div>
            <span className="font-medium">Last Updated:</span>{" "}
            {formatDateTime(updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
