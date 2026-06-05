export const SELECTORS = {
  // Navigation sidebar
  nav: {
    sidebar: "nav",
    dashboard: 'nav a:has-text("Dashboard")',
    analytics: 'nav a:has-text("Analytics")',
    crm: 'nav a:has-text("CRM")',
    bookings: 'nav a:has-text("Bookings")',
    finance: 'nav a:has-text("Finance")',
    units: 'nav a:has-text("Units")',
    owners: 'nav a:has-text("Owners")',
    clients: 'nav a:has-text("Clients")',
    reviews: 'nav a:has-text("Reviews")',
    notifications: 'nav a:has-text("Notifications")',
    areas: 'nav a:has-text("Areas")',
    amenities: 'nav a:has-text("Amenities")',
    adminUsers: 'nav a:has-text("Admin Users")',
  },

  // Dashboard Overview
  dashboard: {
    header: 'h1:has-text("Dashboard Overview")',
    totalActiveUnitsCard: 'div:has-text("Total Active Units")',
    openLeadsCard: 'div:has-text("Open Leads")',
    activeBookingsCard: 'div:has-text("Active Bookings")',
    totalRevenueCard: 'div:has-text("Total Revenue")',
  },

  // Forms
  forms: {
    submitButton: 'button[type="submit"]',
    cancelButton: 'button:has-text("Cancel")',
    inputByName: (name: string) => `input[name="${name}"]`,
    selectByName: (name: string) => `select[name="${name}"]`,
    textareaByName: (name: string) => `textarea[name="${name}"]`,
  },

  // List Views & CRUD Actions
  list: {
    createButton: 'button:has-text("Create"), button:has-text("Add")',
    editButton: 'button:has-text("Edit")',
    deleteButton: 'button:has-text("Delete")',
    saveButton: 'button:has-text("Save"), button:has-text("Confirm")',
    searchField: 'input[placeholder*="Search"]',
    tableRow: "tbody tr",
    tableCell: "td",
  },
};
