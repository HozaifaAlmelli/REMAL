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
};

export const OWNER_USERS = {
  OwnerA: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Ahmed Hassan",
    phone: "+201001234567",
    password: "Admin@1234",
  },
  OwnerB: {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Mohamed Ali",
    phone: "+201009876543",
    password: "Admin@1234",
  },
};

export const MOCK_CLIENT = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  name: "Sara El-Sayed",
  phone: "+201111111111",
  password: "Admin@1234",
};

export const TEST_PREFIX = "CLI_SMOKE_";
export const CLIENT_PASSWORD = "Client@1234";
