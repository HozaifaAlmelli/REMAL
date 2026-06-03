// ═══════════════════════════════════════════════════════════
// components/public/booking/BookingStep3Review.tsx
// Step 3: Review summary + Submit booking request
// ═══════════════════════════════════════════════════════════

"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSubmitBookingRequest } from "@/lib/hooks/usePublic";
import { Button } from "@/components/ui/Button";
import { BookingPricingSummary } from "./BookingPricingSummary";
import { Badge } from "@/components/ui/Badge";
import { getImageUrl } from "@/lib/utils/image";
import { formatCurrency, formatDate, getNights } from "@/lib/utils/format";
import {
  Users,
  Calendar,
  Phone,
  Mail,
  User,
  AlertTriangle,
} from "lucide-react";
import type {
  PublicUnitDetail,
  UnitImage,
  PricingCalculateResponse,
  PublicCreateCrmLeadRequest,
} from "@/lib/types/public.types";

interface BookingStep3ReviewProps {
  // Unit info
  unit: PublicUnitDetail;
  images: UnitImage[];

  // Step 1 data
  startDate: string;
  endDate: string;
  guestCount: number;

  // Step 2 data
  clientId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string | null;

  // Pricing (pre-fetched from Step 1)
  pricing: PricingCalculateResponse;

  // Navigation
  onBack: () => void;
}

export function BookingStep3Review({
  unit,
  images,
  startDate,
  endDate,
  guestCount,
  clientId,
  contactName,
  contactPhone,
  contactEmail,
  pricing,
  onBack,
}: BookingStep3ReviewProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);

  const submitMutation = useSubmitBookingRequest();

  const coverImage = images.find((img) => img.isCover) || images[0];
  const nightsCount = getNights(startDate, endDate);

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    setSubmitError(null);

    // Build CRM lead request (P06 corrected)
    const leadRequest: PublicCreateCrmLeadRequest = {
      targetUnitId: unit.id,
      desiredCheckInDate: startDate,
      desiredCheckOutDate: endDate,
      guestCount: guestCount || 1,
      source: "website",
      contactName: contactName || "Client User",
      contactPhone: contactPhone || "0000000000",
      contactEmail: contactEmail || undefined,
      clientId: clientId || undefined,
    };

    try {
      const result = await submitMutation.mutateAsync(leadRequest);
      // Navigate to confirmation page with lead ID
      router.push(`/booking-confirmation?id=${result.id}`); // P06: id, NOT leadId
    } catch (error) {
      const errorData = error as {
        response?: { data?: { message?: string; errors?: string[] } };
        message?: string;
      };
      const message =
        errorData?.response?.data?.errors?.[0] ||
        errorData?.response?.data?.message ||
        errorData?.message ||
        "Something went wrong. Please try again.";
      setSubmitError(message);
    } finally {
      submitInFlightRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Unit Summary ─── */}
      <div className="flex gap-4 rounded-xl bg-neutral-50 p-4">
        {coverImage && (
          <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg">
            <Image
              src={getImageUrl(coverImage.fileKey)} // P02: fileKey
              alt={unit.name}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 font-display text-base font-semibold text-neutral-900">
            {unit.name} {/* P01: name, NOT unitName */}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="info">{unit.unitType}</Badge>{" "}
            {/* P01: unitType, NOT type */}
            <span className="text-xs text-neutral-500">
              {unit.maxGuests} guests · {unit.bedrooms} bed · {unit.bathrooms}{" "}
              bath {/* P01 corrected */}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-neutral-900">
            {formatCurrency(unit.basePricePerNight)} / night
          </p>
        </div>
      </div>

      {/* ─── Dates ─── */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Dates
        </h4>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-primary-500" />
          <span className="font-medium text-neutral-900">
            {formatDate(startDate)}
          </span>
          <span className="text-neutral-400">→</span>
          <span className="font-medium text-neutral-900">
            {formatDate(endDate)}
          </span>
          <span className="text-neutral-500">
            ({nightsCount} {nightsCount === 1 ? "night" : "nights"})
          </span>
        </div>
      </div>

      {/* ─── Guests ─── */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Guests
        </h4>
        <div className="flex items-center gap-3 text-sm">
          <Users className="h-4 w-4 text-primary-500" />
          <span className="text-neutral-900">
            {guestCount} {guestCount === 1 ? "guest" : "guests"}
          </span>
        </div>
      </div>

      {/* ─── Pricing ─── */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Pricing
        </h4>
        <BookingPricingSummary pricing={pricing} />
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          A deposit will be required upon confirmation by our team. Final
          pricing may vary based on availability.
        </p>
      </div>

      {/* ─── Contact Info ─── */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Contact Information
        </h4>
        <div className="space-y-2 text-sm">
          {contactName && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-primary-500" />
              <span className="text-neutral-900">{contactName}</span>
            </div>
          )}
          {contactPhone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-primary-500" />
              <span className="text-neutral-900">{contactPhone}</span>
            </div>
          )}
          {contactEmail && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-primary-500" />
              <span className="text-neutral-900">{contactEmail}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Error Display ─── */}
      {submitError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Submission failed
            </p>
            <p className="mt-1 text-sm text-red-700">{submitError}</p>
          </div>
        </div>
      )}

      {/* ─── Submit Button ─── */}
      <div className="space-y-3 border-t border-neutral-100 pt-4">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          isLoading={submitMutation.isPending}
          disabled={submitMutation.isPending}
        >
          Submit Booking Request
        </Button>

        <p className="text-center text-xs text-neutral-500">
          By submitting, you agree to our team contacting you to confirm this
          request. This is not a confirmed booking yet.
        </p>
      </div>

      {/* ─── Back Button ─── */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="w-full"
        disabled={submitMutation.isPending}
      >
        Back to Your Details
      </Button>
    </div>
  );
}
