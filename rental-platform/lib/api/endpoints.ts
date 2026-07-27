export const endpoints = {
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AUTH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  auth: {
    clientRegister: "/api/auth/client/register",
    clientLogin: "/api/auth/client/login",
    adminLogin: "/api/auth/admin/login",
    ownerLogin: "/api/auth/owner/login",
    refresh: "/api/auth/refresh",
    logout: "/api/auth/logout",
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ADMIN USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  adminUsers: {
    list: "/api/admin-users",
    create: "/api/admin-users",
    role: (id: string) => `/api/admin-users/${id}/role`,
    status: (id: string) => `/api/admin-users/${id}/status`,
  },

  adminDirectory: "/api/internal/admin-directory",

  security: {
    permissions: "/api/internal/security/permissions",
    roles: "/api/internal/security/roles",
    role: (id: string) => `/api/internal/security/roles/${id}`,
    userOverrides: (id: string) =>
      `/api/internal/security/users/${id}/overrides`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AMENITIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  amenities: {
    list: "/api/amenities",
    create: "/api/amenities",
    byId: (id: string) => `/api/amenities/${id}`,
    update: (id: string) => `/api/amenities/${id}`,
    status: (id: string) => `/api/amenities/${id}/status`,
  },

  // Projects
  projects: {
    list: "/api/projects",
    create: "/api/projects",
    byId: (id: string) => `/api/projects/${id}`,
    update: (id: string) => `/api/projects/${id}`,
    status: (id: string) => `/api/projects/${id}/status`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ UNITS (PUBLIC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  units: {
    publicList: "/api/units",
    publicById: (id: string) => `/api/units/${id}`,
    images: (unitId: string) => `/api/units/${unitId}/images`,
    amenities: (unitId: string) => `/api/units/${unitId}/amenities`,
    operationalCheck: (unitId: string) =>
      `/api/units/${unitId}/availability/operational-check`,
    pricingCalculate: (unitId: string) =>
      `/api/units/${unitId}/pricing/calculate`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ UNITS (INTERNAL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  internalUnits: {
    list: "/api/internal/units",
    create: "/api/internal/units",
    byId: (id: string) => `/api/internal/units/${id}`,
    update: (id: string) => `/api/internal/units/${id}`,
    delete: (id: string) => `/api/internal/units/${id}`,
    status: (id: string) => `/api/internal/units/${id}/status`,
    portfolioVisibility: (id: string) =>
      `/api/internal/units/${id}/portfolio-visibility`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ UNIT IMAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  internalUnitImages: {
    create: (unitId: string) => `/api/internal/units/${unitId}/images`,
    upload: (unitId: string) => `/api/internal/units/${unitId}/images/upload`,
    reorder: (unitId: string) => `/api/internal/units/${unitId}/images/reorder`,
    cover: (unitId: string, imageId: string) =>
      `/api/internal/units/${unitId}/images/${imageId}/cover`,
    delete: (unitId: string, imageId: string) =>
      `/api/internal/units/${unitId}/images/${imageId}`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ UNIT AMENITIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  internalUnitAmenities: {
    add: (unitId: string) => `/api/internal/units/${unitId}/amenities`,
    replace: (unitId: string) => `/api/internal/units/${unitId}/amenities`,
    remove: (unitId: string, amenityId: string) =>
      `/api/internal/units/${unitId}/amenities/${amenityId}`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SEASONAL PRICING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  seasonalPricing: {
    list: (unitId: string) => `/api/internal/units/${unitId}/seasonal-pricing`,
    create: (unitId: string) =>
      `/api/internal/units/${unitId}/seasonal-pricing`,
    update: (id: string) => `/api/internal/seasonal-pricing/${id}`,
    delete: (id: string) => `/api/internal/seasonal-pricing/${id}`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DATE BLOCKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  dateBlocks: {
    list: (unitId: string) => `/api/internal/units/${unitId}/date-blocks`,
    create: (unitId: string) => `/api/internal/units/${unitId}/date-blocks`,
    update: (id: string) => `/api/internal/date-blocks/${id}`,
    delete: (id: string) => `/api/internal/date-blocks/${id}`,
    approvals: "/api/internal/date-blocks/approvals",
    resolve: (id: string) => `/api/internal/date-blocks/${id}/resolve`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ BOOKINGS (INTERNAL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  internalBookings: {
    list: "/api/internal/bookings",
    create: "/api/internal/bookings",
    quickCreate: "/api/internal/bookings/quick",
    byId: (id: string) => `/api/internal/bookings/${id}`,
    update: (id: string) => `/api/internal/bookings/${id}`,
    statusHistory: (id: string) =>
      `/api/internal/bookings/${id}/status-history`,
  },

  clientBookings: {
    list: "/api/client/bookings",
    create: "/api/client/bookings",
    byId: (id: string) => `/api/client/bookings/${id}`,
  },

  clientProfile: {
    get: "/api/client/profile",
    update: "/api/client/profile",
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ BOOKING LIFECYCLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  bookingLifecycle: {
    confirm: (id: string) => `/api/internal/bookings/${id}/confirm`,
    booked: (id: string) => `/api/internal/bookings/${id}/booked`,
    relevant: (id: string) => `/api/internal/bookings/${id}/relevant`,
    noAnswer: (id: string) => `/api/internal/bookings/${id}/no-answer`,
    notRelevant: (id: string) => `/api/internal/bookings/${id}/not-relevant`,
    cancel: (id: string) => `/api/internal/bookings/${id}/cancel`,
    complete: (id: string) => `/api/internal/bookings/${id}/complete`,
    checkIn: (id: string) => `/api/internal/bookings/${id}/check-in`,
    leftEarly: (id: string) => `/api/internal/bookings/${id}/left-early`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CRM LEADS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  crmLeads: {
    publicCreate: "/api/crm/leads",
    create: "/api/internal/crm/leads", // Internal endpoint for admin use
    list: "/api/internal/crm/leads",
    openCount: "/api/internal/crm/leads/open-count",
    byId: (id: string) => `/api/internal/crm/leads/${id}`,
    update: (id: string) => `/api/internal/crm/leads/${id}`,
    status: (id: string) => `/api/internal/crm/leads/${id}/status`,
    convertToBooking: (id: string) =>
      `/api/internal/crm/leads/${id}/convert-to-booking`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CRM NOTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  crmNotes: {
    bookingNotesList: (bookingId: string) =>
      `/api/internal/bookings/${bookingId}/notes`,
    bookingNotesCreate: (bookingId: string) =>
      `/api/internal/bookings/${bookingId}/notes`,
    leadNotesList: (leadId: string) =>
      `/api/internal/crm/leads/${leadId}/notes`,
    leadNotesCreate: (leadId: string) =>
      `/api/internal/crm/leads/${leadId}/notes`,
    update: (id: string) => `/api/internal/crm/notes/${id}`,
    delete: (id: string) => `/api/internal/crm/notes/${id}`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CRM ASSIGNMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  crmAssignments: {
    assignees: "/api/internal/crm/assignees",
    bookingGet: (bookingId: string) =>
      `/api/internal/bookings/${bookingId}/assignment`,
    bookingSet: (bookingId: string) =>
      `/api/internal/bookings/${bookingId}/assignment`,
    bookingDelete: (bookingId: string) =>
      `/api/internal/bookings/${bookingId}/assignment`,
    leadGet: (leadId: string) => `/api/internal/crm/leads/${leadId}/assignment`,
    leadSet: (leadId: string) => `/api/internal/crm/leads/${leadId}/assignment`,
    leadDelete: (leadId: string) =>
      `/api/internal/crm/leads/${leadId}/assignment`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PAYMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  payments: {
    list: "/api/internal/payments",
    create: "/api/internal/payments",
    byId: (id: string) => `/api/internal/payments/${id}`,
    markPaid: (id: string) => `/api/internal/payments/${id}/mark-paid`,
    markFailed: (id: string) => `/api/internal/payments/${id}/mark-failed`,
    cancel: (id: string) => `/api/internal/payments/${id}/cancel`,
    linkPaidToInvoices: "/api/internal/payments/link-paid-to-invoices",
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ INVOICES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  invoices: {
    list: "/api/internal/invoices",
    byId: (id: string) => `/api/internal/invoices/${id}`,
    createDraft: "/api/internal/invoices/drafts",
    addAdjustment: (id: string) =>
      `/api/internal/invoices/${id}/items/manual-adjustment`,
    issue: (id: string) => `/api/internal/invoices/${id}/issue`,
    cancel: (id: string) => `/api/internal/invoices/${id}/cancel`,
    reissue: (id: string) => `/api/internal/invoices/${id}/reissue`,
    balance: (id: string) => `/api/internal/invoices/${id}/balance`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ FINANCE SUMMARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  financeSummary: {
    overview: "/api/internal/finance/overview",
    bookingFinanceSnapshot: (bookingId: string) =>
      `/api/internal/bookings/${bookingId}/finance-snapshot`,
    ownerPayoutSummary: (ownerId: string) =>
      `/api/internal/owners/${ownerId}/payout-summary`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ OWNER PAYOUTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ownerPayouts: {
    byBooking: (bookingId: string) =>
      `/api/internal/owner-payouts/by-booking/${bookingId}`,
    byOwner: (ownerId: string) => `/api/internal/owners/${ownerId}/payouts`,
    create: "/api/internal/owner-payouts",
    schedule: (id: string) => `/api/internal/owner-payouts/${id}/schedule`,
    markPaid: (id: string) => `/api/internal/owner-payouts/${id}/mark-paid`,
    cancel: (id: string) => `/api/internal/owner-payouts/${id}/cancel`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REPORTS â€” BOOKINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  reportsBookings: {
    daily: "/api/internal/reports/bookings/daily",
    summary: "/api/internal/reports/bookings/summary",
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REPORTS â€” FINANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  reportsFinance: {
    daily: "/api/internal/reports/finance/daily",
    summary: "/api/internal/reports/finance/summary",
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ OWNERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  owners: {
    list: "/api/owners",
    create: "/api/owners",
    byId: (id: string) => `/api/owners/${id}`,
    update: (id: string) => `/api/owners/${id}`,
    status: (id: string) => `/api/owners/${id}/status`,
    units: (id: string) => `/api/owners/${id}/units`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CLIENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  clients: {
    list: "/api/clients",
    byId: (id: string) => `/api/clients/${id}`,
    status: (id: string) => `/api/clients/${id}/status`,
    password: (id: string) => `/api/clients/${id}/password`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REVIEWS â€” PUBLIC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  publicReviews: {
    byUnitSummary: (unitId: string) =>
      `/api/public/units/${unitId}/reviews/summary`,
    byUnitList: (unitId: string) => `/api/public/units/${unitId}/reviews`,
    byUnitDetail: (unitId: string, reviewId: string) =>
      `/api/public/units/${unitId}/reviews/${reviewId}`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REVIEWS â€” CLIENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  clientReviews: {
    create: "/api/client/reviews",
    update: (reviewId: string) => `/api/client/reviews/${reviewId}`,
    byBooking: (bookingId: string) =>
      `/api/client/reviews/by-booking/${bookingId}`,
  },

  // ── REVIEW MODERATION ──
  reviewModeration: {
    list: "/api/internal/reviews",
    publish: (reviewId: string) => `/api/internal/reviews/${reviewId}/publish`,
    reject: (reviewId: string) => `/api/internal/reviews/${reviewId}/reject`,
    hide: (reviewId: string) => `/api/internal/reviews/${reviewId}/hide`,
    statusHistory: (reviewId: string) =>
      `/api/internal/reviews/${reviewId}/status-history`,
  },

  // ──────────────── REVIEW REPLIES (Owner) ────────────────
  reviewReplies: {
    get: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
    upsert: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
    delete: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
    visibility: (reviewId: string) =>
      `/api/owner/reviews/${reviewId}/reply/visibility`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ NOTIFICATION INBOX (3 personas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  notifications: {
    admin: {
      inbox: "/api/internal/me/notifications/inbox",
      summary: "/api/internal/me/notifications/inbox/summary",
      read: (id: string) => `/api/internal/me/notifications/inbox/${id}/read`,
      readAll: "/api/internal/me/notifications/inbox/read-all",
    },
    client: {
      inbox: "/api/client/me/notifications/inbox",
      summary: "/api/client/me/notifications/inbox/summary",
      read: (id: string) => `/api/client/me/notifications/inbox/${id}/read`,
      readAll: "/api/client/me/notifications/inbox/read-all",
    },
    owner: {
      inbox: "/api/owner/me/notifications/inbox",
      summary: "/api/owner/me/notifications/inbox/summary",
      read: (id: string) => `/api/owner/me/notifications/inbox/${id}/read`,
      readAll: "/api/owner/me/notifications/inbox/read-all",
    },
  },

  //  NOTIFICATION PREFERENCES (3 personas)
  notificationPreferences: {
    adminGet: "/api/internal/me/notification-preferences",
    adminUpdate: "/api/internal/me/notification-preferences",
    clientGet: "/api/client/me/notification-preferences",
    clientUpdate: "/api/client/me/notification-preferences",
    ownerGet: "/api/owner/me/notification-preferences",
    ownerUpdate: "/api/owner/me/notification-preferences",
  },

  // ──────────── INTERNAL NOTIFICATIONS (dispatch) ────────────
  internalNotifications: {
    recipients: (subjectType: "Admin" | "Client" | "Owner") =>
      `/api/internal/notifications/recipients/${subjectType}`,
    toAdmin: (adminUserId: string) =>
      `/api/internal/notifications/admins/${adminUserId}`,
    toClient: (clientId: string) =>
      `/api/internal/notifications/clients/${clientId}`,
    toOwner: (ownerId: string) =>
      `/api/internal/notifications/owners/${ownerId}`,
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ OWNER PORTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ownerPortal: {
    dashboard: "/api/owner/dashboard",
    profile: "/api/owner/profile", // Backend gap: Not documented in API Reference
    units: {
      list: "/api/owner/units",
      detail: (unitId: string) => `/api/owner/units/${unitId}`,
      dateBlocks: (unitId: string) => `/api/owner/units/${unitId}/date-blocks`,
      dateBlocksList: (unitId: string) =>
        `/api/owner/units/${unitId}/date-blocks`,
      dateBlocksPreflight: (unitId: string) =>
        `/api/owner/units/${unitId}/date-blocks/preflight`,
      dateBlockDelete: (unitId: string, blockId: string) =>
        `/api/owner/units/${unitId}/date-blocks/${blockId}`,
    },
    bookings: {
      list: "/api/owner/bookings",
      detail: (bookingId: string) => `/api/owner/bookings/${bookingId}`,
    },
    finance: {
      list: "/api/owner/finance",
      summary: "/api/owner/finance/summary",
    },
    reviews: {
      createReply: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
      updateReply: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
      deleteReply: (reviewId: string) => `/api/owner/reviews/${reviewId}/reply`,
    },
  },
} as const;
