export const CRM_LEAD_STATUSES = {
  New: "New",
  Contacted: "Contacted",
  Qualified: "Qualified",
  Converted: "Converted",
  Lost: "Lost",
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
  New: "New",
  Contacted: "Contacted",
  Qualified: "Qualified",
  Converted: "Converted",
  Lost: "Lost",
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

export const CRM_PIPELINE_COLUMNS: CrmLeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
];

export const CRM_CLOSED_STATUSES: CrmLeadStatus[] = [
  "Converted",
  "Lost",
];

export const CRM_VALID_TRANSITIONS: Record<CrmLeadStatus, CrmLeadStatus[]> = {
  New: ["Contacted", "Lost"],
  Contacted: ["Qualified", "Lost"],
  Qualified: ["Converted", "Lost"],
  Converted: [],
  Lost: [],
};

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
