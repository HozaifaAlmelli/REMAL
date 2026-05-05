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
  Pending: "Pending",
  Confirmed: "Confirmed",
  Completed: "Completed",
  Cancelled: "Cancelled",
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
  Pending: "Pending",
  Confirmed: "Confirmed",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  Pending: "warning",
  Confirmed: "success",
  Completed: "success",
  Cancelled: "danger",
} as const;

export const CRM_PIPELINE_COLUMNS: CrmLeadStatus[] = [
  "Prospecting",
  "Relevant",
  "NoAnswer",
  "Booked",
  "Confirmed",
  "CheckIn",
  "Completed",
];

export const CRM_CLOSED_STATUSES: CrmLeadStatus[] = [
  "NotRelevant",
  "Cancelled",
  "LeftEarly",
];

export const CRM_VALID_TRANSITIONS: Record<CrmLeadStatus, CrmLeadStatus[]> = {
  Prospecting: ["Relevant", "NoAnswer", "NotRelevant"],
  Relevant: ["Booked", "NoAnswer", "NotRelevant"],
  NoAnswer: ["Relevant", "NotRelevant"],
  Booked: ["Confirmed", "NotRelevant"],
  Confirmed: ["CheckIn", "Cancelled"],
  CheckIn: ["Completed", "LeftEarly"],
  Completed: [],
  Cancelled: [],
  LeftEarly: [],
  NotRelevant: [],
};

export const BOOKING_VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> =
  {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["Completed", "Cancelled"],
    Completed: [],
    Cancelled: [],
  };
