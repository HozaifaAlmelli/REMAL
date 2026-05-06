// ═══════════════════════════════════════════════════════════
// lib/validations/booking.ts
// Zod schemas for booking and CRM lead forms
// ═══════════════════════════════════════════════════════════

import { z } from "zod";

/**
 * CRM Lead Request Schema (P06 corrected field names)
 * Used for client-side pre-validation before submitting booking form
 *
 * P06 corrections:
 * - targetUnitId (NOT unitId)
 * - desiredCheckInDate / desiredCheckOutDate (NOT checkInDate / checkOutDate)
 * - guestCount (NOT numberOfGuests)
 * - contactName / contactPhone / contactEmail (NOT name / phone / email)
 */
export const crmLeadRequestSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    targetUnitId: z.string().uuid({ message: "Invalid unit ID" }),
    contactName: z
      .string()
      .min(1, "Contact name is required")
      .max(200, "Contact name is too long"),
    contactPhone: z
      .string()
      .min(1, "Contact phone is required")
      .regex(
        /^01[0-9]{9}$/,
        "Enter a valid Egyptian phone number (e.g., 01012345678)"
      ),
    contactEmail: z
      .string()
      .email("Invalid email address")
      .optional()
      .or(z.literal(""))
      .transform((val) => (val === "" ? undefined : val)), // Convert "" to undefined
    desiredCheckInDate: z.string().min(1, "Check-in date is required"),
    desiredCheckOutDate: z.string().min(1, "Check-out date is required"),
    guestCount: z
      .number()
      .int("Guest count must be a whole number")
      .min(1, "At least 1 guest required")
      .max(50, "Maximum 50 guests allowed"),
    source: z.enum(["website", "direct", "whatsapp", "phone", "admin"], {
      errorMap: () => ({ message: "Invalid source" }),
    }),
    notes: z.string().max(2000, "Notes are too long").optional(),
  })
  .refine((data) => data.desiredCheckOutDate > data.desiredCheckInDate, {
    message: "Check-out date must be after check-in date",
    path: ["desiredCheckOutDate"],
  });

export type CrmLeadRequestFormData = z.infer<typeof crmLeadRequestSchema>;
