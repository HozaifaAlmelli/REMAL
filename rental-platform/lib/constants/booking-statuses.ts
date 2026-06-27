export const CRM_LEAD_STATUSES = {
  Prospecting: "Prospecting",
  Relevant: "Relevant",
  NoAnswer: "NoAnswer",
  NotRelevant: "NotRelevant",
  Booked: "Booked",
  Confirmed: "Confirmed",
  CheckIn: "CheckIn",
  Completed: "Completed",
  Cancelled: "Cancelled",
  LeftEarly: "LeftEarly",
} as const;

export type CrmLeadStatus =
  (typeof CRM_LEAD_STATUSES)[keyof typeof CRM_LEAD_STATUSES];

export const BOOKING_STATUSES = {
  Prospecting: "Prospecting",
  Relevant: "Relevant",
  NoAnswer: "NoAnswer",
  NotRelevant: "NotRelevant",
  Booked: "Booked",
  Confirmed: "Confirmed",
  CheckIn: "CheckIn",
  Completed: "Completed",
  Cancelled: "Cancelled",
  LeftEarly: "LeftEarly",
} as const;

export type BookingStatus =
  (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES];

export const CRM_STATUS_LABELS: Record<CrmLeadStatus, string> = {
  Prospecting: "Prospecting",
  Relevant: "Relevant",
  NoAnswer: "No Answer",
  NotRelevant: "Not Relevant",
  Booked: "Booked",
  Confirmed: "Confirmed",
  CheckIn: "Check In",
  Completed: "Completed",
  Cancelled: "Cancelled",
  LeftEarly: "Left Early",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  Prospecting: "Prospecting",
  Relevant: "Relevant",
  NoAnswer: "No Answer",
  NotRelevant: "Not Relevant",
  Booked: "Booked",
  Confirmed: "Confirmed",
  CheckIn: "Check In",
  Completed: "Completed",
  Cancelled: "Cancelled",
  LeftEarly: "Left Early",
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  Prospecting: "warning",
  Relevant: "warning",
  NoAnswer: "warning",
  NotRelevant: "neutral",
  Booked: "info",
  Confirmed: "success",
  CheckIn: "info",
  Completed: "success",
  Cancelled: "danger",
  LeftEarly: "warning",
} as const;

// Lead board ends at "Booked". Forward progress past Booked happens only via
// "Convert to Booking" (which creates a Booking and closes the lead as Completed).
// Confirmed / CheckIn belong to the BOOKING lifecycle, not the lead pipeline.
export const CRM_PIPELINE_COLUMNS: CrmLeadStatus[] = [
  "Prospecting",
  "Relevant",
  "NoAnswer",
  "Booked",
];

export const CRM_CLOSED_STATUSES: CrmLeadStatus[] = [
  "NotRelevant",
  "Completed",
  "Cancelled",
  "LeftEarly",
];

export const CRM_VALID_TRANSITIONS: Record<CrmLeadStatus, CrmLeadStatus[]> = {
  Prospecting: ["Relevant", "NoAnswer", "NotRelevant"],
  Relevant: ["Booked", "NoAnswer", "NotRelevant"],
  NoAnswer: ["Relevant", "NotRelevant"],
  // Booked is terminal for the lead board — move forward by converting to a booking.
  Booked: ["NotRelevant"],
  Confirmed: [],
  CheckIn: [],
  NotRelevant: [],
  Completed: [],
  Cancelled: [],
  LeftEarly: [],
};

// Booking statuses for which invoices and payments may be created. Mirrors the
// backend's BookingStatusTransitions.FinanceEligibleStatuses: a financial relationship
// only exists once a booking is real, so pre-booking leads (Prospecting/Relevant/NoAnswer)
// and dead records (NotRelevant/Cancelled) are excluded.
export const FINANCE_ELIGIBLE_STATUSES: BookingStatus[] = [
  "Booked",
  "Confirmed",
  "CheckIn",
  "Completed",
  "LeftEarly",
];

export function isFinanceEligibleStatus(status?: BookingStatus | null): boolean {
  return status != null && FINANCE_ELIGIBLE_STATUSES.includes(status);
}

export const BOOKING_VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> =
  {
    Prospecting: ["Relevant", "NoAnswer", "NotRelevant"],
    Relevant: ["Booked", "NoAnswer", "NotRelevant"],
    NoAnswer: ["Relevant", "NotRelevant"],
    Booked: ["Confirmed", "NotRelevant"],
    Confirmed: ["CheckIn", "Cancelled"],
    CheckIn: ["Completed", "LeftEarly"],
    Completed: [],
    Cancelled: [],
    NotRelevant: [],
    LeftEarly: [],
  };
