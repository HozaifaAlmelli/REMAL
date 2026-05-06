export const CRM_LEAD_STATUSES = {
  new: "new",
  contacted: "contacted",
  qualified: "qualified",
  converted: "converted",
  lost: "lost",
} as const;

export type CrmLeadStatus =
  (typeof CRM_LEAD_STATUSES)[keyof typeof CRM_LEAD_STATUSES];

export const BOOKING_STATUSES = {
  Pending: "pending",
  Confirmed: "confirmed",
  Completed: "completed",
  Cancelled: "cancelled",
} as const;

export type BookingStatus =
  (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES];

export const CRM_STATUS_LABELS: Record<CrmLeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "warning",
  confirmed: "success",
  completed: "success",
  cancelled: "danger",
} as const;

export const CRM_PIPELINE_COLUMNS: CrmLeadStatus[] = [
  "new",
  "contacted",
  "qualified",
];

export const CRM_CLOSED_STATUSES: CrmLeadStatus[] = [
  "converted",
  "lost",
];

export const CRM_VALID_TRANSITIONS: Record<CrmLeadStatus, CrmLeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["converted", "lost"],
  converted: [],
  lost: [],
};

export const BOOKING_VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> =
  {
    pending: ["confirmed", "cancelled"],
    confirmed: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
