export const ADMIN_USERS = {
  SuperAdmin: {
    email: "superadmin.dev@rental.local",
    password: "Admin@1234",
    role: "SuperAdmin" as const,
  },
  Sales: {
    email: "sales.dev@rental.local",
    password: "Admin@1234",
    role: "Sales" as const,
  },
  Finance: {
    email: "finance.dev@rental.local",
    password: "Admin@1234",
    role: "Finance" as const,
  },
  Tech: {
    email: "tech.dev@rental.local",
    password: "Admin@1234",
    role: "Tech" as const,
  },
};

export const MOCK_OWNER = {
  name: "Ahmed Hassan",
  phone: "+201001234567",
  password: "Admin@1234",
};

export const MOCK_CLIENT = {
  name: "Sara El-Sayed",
  phone: "+201111111111",
  password: "Admin@1234",
};

export const TEST_AREA = {
  name: "SMOKE_TEST_AREA",
  description: "Area created for E2E smoke tests",
  isActive: true,
};

export const TEST_UNIT = {
  name: "SMOKE_TEST_UNIT",
  description: "Unit created for E2E smoke tests",
  address: "123 Smoke Test St, Sahel",
  unitType: "villa" as const,
  bedrooms: 4,
  bathrooms: 3,
  maxGuests: 8,
  basePricePerNight: 5000.00,
  isActive: true,
};

export const TEST_LEAD = {
  contactName: "E2E Lead Client",
  contactPhone: "+201999999999",
  contactEmail: "e2e.lead@example.com",
  source: "Website",
  desiredCheckInDate: "2026-07-01",
  desiredCheckOutDate: "2026-07-05",
  guestCount: 4,
  notes: "E2E Lead Notes",
};
