export const ROUTES = {
  // Public
  home: "/",
  unitsList: "/units",
  unitDetail: (id: string) => `/units/${id}`,
  bookingConfirmation: (id: string) => `/bookings/${id}`,

  // Auth
  auth: {
    adminLogin: "/auth/admin/login",
    ownerLogin: "/auth/owner/login",
    clientLogin: "/auth/client/login",
    register: "/auth/client/register",
  },

  // Admin
  admin: {
    root: "/admin",
    dashboard: "/admin/dashboard",
    analytics: "/admin/analytics",
    approvals: "/admin/approvals",
    projects: "/admin/projects",
    units: {
      list: "/admin/units",
      detail: (id: string) => `/admin/units/${id}`,
      create: "/admin/units/new",
      edit: (id: string) => `/admin/units/${id}/edit`,
    },
    crm: {
      index: "/admin/crm",
      leadDetail: (id: string) => `/admin/crm/leads/${id}`,
    },
    bookings: {
      list: "/admin/bookings",
      detail: (id: string) => `/admin/bookings/${id}`,
    },
    finance: "/admin/finance",
    financePayments: "/admin/finance/payments",
    financePayouts: "/admin/finance/payouts",
    owners: {
      list: "/admin/owners",
      detail: (id: string) => `/admin/owners/${id}`,
      create: "/admin/owners/new",
      edit: (id: string) => `/admin/owners/${id}/edit`,
    },
    clients: {
      list: "/admin/clients",
      detail: (id: string) => `/admin/clients/${id}`,
    },
    reviews: "/admin/reviews",
    notifications: "/admin/notifications",
    settings: "/admin/settings",
  },

  // Owner Portal
  owner: {
    root: "/owner",
    dashboard: "/owner/dashboard",
    units: "/owner/units",
    unitDetail: (id: string) => `/owner/units/${id}`,
    bookings: "/owner/bookings",
    bookingDetail: (id: string) => `/owner/bookings/${id}`,
    finance: "/owner/finance",
    reviews: "/owner/reviews",
    notifications: "/owner/notifications",
    profile: "/owner/profile",
  },

  // Client / Account
  client: {
    account: "/account",
    bookings: "/account/bookings",
    bookingReview: (id: string) => `/account/bookings/${id}/review`,
    notifications: "/account/notifications",
  },
} as const;
