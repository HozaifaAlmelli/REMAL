import { ReportDateFilters, ReportDailyFilters } from "../types/report.types";

export const queryKeys = {
  reports: {
    all: ["reports"] as const,
    bookingsSummary: (filters?: ReportDateFilters) =>
      ["reports", "bookings", filters] as const,
    financeSummary: (filters?: ReportDateFilters) =>
      ["reports", "finance", filters] as const,
    bookingsDaily: (filters?: ReportDailyFilters) =>
      ["reports", "bookingsDaily", filters] as const,
    financeDaily: (filters?: ReportDailyFilters) =>
      ["reports", "financeDaily", filters] as const,
  },
  units: {
    all: ["units"] as const,
    publicList: (filters?: object) =>
      ["units", "public", "list", filters] as const,
    publicDetail: (id: string) => ["units", "public", "detail", id] as const,
    internalList: (filters?: object) =>
      ["units", "internal", "list", filters] as const,
    internalDetail: (id: string) =>
      ["units", "internal", "detail", id] as const,
    images: (unitId: string) => ["units", unitId, "images"] as const,
    amenities: (unitId: string) => ["units", unitId, "amenities"] as const,
    dateBlocks: (unitId: string) => ["units", unitId, "dateBlocks"] as const,
    seasonalPricing: (unitId: string) =>
      ["units", unitId, "seasonalPricing"] as const,
    availability: (unitId: string, month?: number, year?: number) =>
      ["units", unitId, "availability", month, year] as const,
    pricing: (unitId: string, filters: object) =>
      ["units", unitId, "pricing", filters] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: (includeInactive: boolean) =>
      ["projects", "list", { includeInactive }] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  owners: {
    all: ["owners"] as const,
    list: (filters?: object) => ["owners", "list", filters] as const,
    detail: (id: string) => ["owners", "detail", id] as const,
    payouts: (id: string) => ["owners", id, "payouts"] as const,
    payoutSummary: (id: string) => ["owners", id, "payout-summary"] as const,
    units: (id: string) => ["owners", id, "units"] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    publicByUnit: (unitId: string) =>
      ["reviews", "public", "unit", unitId] as const,
    publicSummary: (unitId: string) =>
      ["reviews", "public", "summary", unitId] as const,
    publicDetail: (unitId: string, reviewId: string) =>
      ["reviews", "public", "detail", unitId, reviewId] as const,
    statusHistory: (reviewId: string) =>
      ["reviews", "statusHistory", reviewId] as const,
    byBooking: (bookingId: string) =>
      ["reviews", "byBooking", bookingId] as const,
    moderation: (filters?: object) =>
      ["reviews", "moderation", filters ?? {}] as const,

    reply: (reviewId: string) => ["reviews", "reply", reviewId] as const,
  },
  notifications: {
    adminInbox: () => ["notifications", "admin", "inbox"] as const,
    adminInboxSummary: () =>
      ["notifications", "admin", "inbox", "summary"] as const,
    adminPreferences: () => ["notifications", "admin", "preferences"] as const,
    ownerInbox: () => ["notifications", "owner", "inbox"] as const,
    ownerInboxSummary: () =>
      ["notifications", "owner", "inbox", "summary"] as const,
    ownerPreferences: () => ["notifications", "owner", "preferences"] as const,
    clientInbox: (filters?: object) =>
      ["notifications", "client", "inbox", filters ?? {}] as const,
    clientInboxSummary: () =>
      ["notifications", "client", "inbox", "summary"] as const,
    clientPreferences: () =>
      ["notifications", "client", "preferences"] as const,
    recipients: (subjectType: "Admin" | "Client" | "Owner") =>
      ["notifications", "recipients", subjectType] as const,
  },
  ownerPortal: {
    all: ["ownerPortal"] as const,
    dashboardSummary: () => ["ownerPortal", "dashboard"] as const,
    profile: () => ["ownerPortal", "profile"] as const,
    units: {
      all: ["ownerPortal", "units"] as const,
      list: (filters?: object) =>
        ["ownerPortal", "units", "list", filters] as const,
      detail: (unitId: string) =>
        ["ownerPortal", "units", "detail", unitId] as const,
      dateBlocks: (unitId: string) =>
        ["ownerPortal", "units", "dateBlocks", unitId] as const,
      dateBlockPreflight: (
        unitId: string,
        startDate: string | null,
        endDate: string | null
      ) =>
        [
          "ownerPortal",
          "units",
          "dateBlockPreflight",
          unitId,
          startDate,
          endDate,
        ] as const,
    },
    unitAvailability: (unitId: string, startDate: string, endDate: string) =>
      ["ownerPortal", "unitAvailability", unitId, startDate, endDate] as const,
    bookings: {
      all: ["ownerPortal", "bookings"] as const,
      list: (filters?: object) =>
        ["ownerPortal", "bookings", "list", filters] as const,
      detail: (bookingId: string) =>
        ["ownerPortal", "bookings", "detail", bookingId] as const,
    },
    finance: {
      all: ["ownerPortal", "finance"] as const,
      list: (filters?: object) =>
        ["ownerPortal", "finance", "list", filters] as const,
      summary: () => ["ownerPortal", "finance", "summary"] as const,
    },
    reviews: {
      all: ["ownerPortal", "reviews"] as const,
    },
  },
  dateBlockApprovals: {
    all: ["dateBlockApprovals"] as const,
    list: () => ["dateBlockApprovals", "list"] as const,
  },
};
