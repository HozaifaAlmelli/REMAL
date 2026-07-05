# Kaza Booking Platform — API Reference Documentation
**Version:** v1 | **Base URL:** `https://{your-domain}`
**Auth:** Bearer Token (JWT) via `Authorization: Bearer {token}` header
**All responses follow the envelope:** `{ success, data, message, errors, pagination }`

---

## Table of Contents

1. [Auth](#1-auth)
2. [Admin Users](#2-admin-users)
3. [Projects](#3-projects)
4. [Amenities](#4-amenities)
5. [Units](#5-units)
6. [Unit Images](#6-unit-images)
7. [Unit Amenities](#7-unit-amenities)
8. [Unit Availability & Pricing](#8-unit-availability--pricing)
9. [Seasonal Pricing](#9-seasonal-pricing)
10. [Date Blocks](#10-date-blocks)
11. [Owners](#11-owners)
12. [Clients](#12-clients)
13. [CRM Leads](#13-crm-leads)
14. [CRM Notes](#14-crm-notes)
15. [CRM Assignments](#15-crm-assignments)
16. [Bookings](#16-bookings)
17. [Booking Lifecycle](#17-booking-lifecycle)
18. [Payments](#18-payments)
19. [Invoices](#19-invoices)
20. [Finance Summary](#20-finance-summary)
21. [Owner Payouts](#21-owner-payouts)
22. [Reviews — Client](#22-reviews--client)
23. [Reviews — Public](#23-reviews--public)
24. [Reviews — Moderation (Admin)](#24-reviews--moderation-admin)
25. [Review Replies (Owner)](#25-review-replies-owner)
26. [Owner Portal — Dashboard](#26-owner-portal--dashboard)
27. [Owner Portal — Units](#27-owner-portal--units)
28. [Owner Portal — Bookings](#28-owner-portal--bookings)
29. [Owner Portal — Finance](#29-owner-portal--finance)
30. [Notifications — Internal (Admin)](#30-notifications--internal-admin)
31. [Notifications — Dispatch](#31-notifications--dispatch)
32. [Notification Inbox](#32-notification-inbox)
33. [Notification Preferences](#33-notification-preferences)
34. [Reporting — Bookings Analytics](#34-reporting--bookings-analytics)
35. [Reporting — Finance Analytics](#35-reporting--finance-analytics)

---

## Shared Response Envelope

Every endpoint returns this wrapper:

```json
{
  "success": true,
  "data": { },
  "message": "string | null",
  "errors": ["string"] | null,
  "pagination": {
    "totalCount": 0,
    "page": 0,
    "pageSize": 0,
    "totalPages": 0
  }
}
```

`pagination` is `null` for single-object responses.

---

## 1. Auth

### POST `/api/auth/client/register`
**Access:** Public
**Description:** Register a new client account. Returns the created client profile (no token — login separately).

**Request Body:**
```json
{
  "name": "string",       // required
  "phone": "string",      // required — unique
  "email": "string",      // optional — unique if provided
  "password": "string"    // required — min 8 chars
}
```

**Response `data`:**
```json
{
  "id": "uuid",
  "name": "string",
  "phone": "string",
  "email": "string",
  "isActive": true,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/auth/client/login`
**Access:** Public
**Description:** Authenticate a client using phone + password. Returns JWT access token.

**Request Body:**
```json
{
  "phone": "string",
  "password": "string"
}
```

**Response `data`:**
```json
{
  "accessToken": "string",
  "expiresInSeconds": 900,
  "subjectType": "Client",
  "adminRole": null,
  "user": {
    "userId": "uuid",
    "identifier": "string",
    "subjectType": "Client",
    "adminRole": null
  }
}
```

---

### POST `/api/auth/admin/login`
**Access:** Public
**Description:** Authenticate an admin user using email + password.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response `data`:** Same as client login. `adminRole` will be one of: `SuperAdmin | Sales | Finance | Tech`

---

### POST `/api/auth/owner/login`
**Access:** Public
**Description:** Authenticate an owner using phone + password.

**Request Body:**
```json
{
  "phone": "string",
  "password": "string"
}
```

**Response `data`:** Same as client login. `subjectType` = `"Owner"`

---

### POST `/api/auth/refresh`
**Access:** Any authenticated user (uses HttpOnly cookie)
**Description:** Refresh the access token using the refresh token stored in the HttpOnly cookie. No request body needed.

**Response `data`:** Same as login response with new `accessToken`.

---

### POST `/api/auth/logout`
**Access:** Any authenticated user
**Description:** Invalidate the current session and clear the refresh token cookie.

**Response `data`:** `"string"` (success message)

---

## 2. Admin Users

### GET `/api/admin-users`
**Access:** SuperAdmin
**Description:** List all admin users with optional filtering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page |
| `projectId` | uuid | null | Filter by project |
| `unitType` | string | null | Filter by unit type (`apartment`, `villa`, `chalet`, `studio`) |
| `minGuests` | integer | null | Include units with at least this guest capacity |
| `minPrice` | decimal | null | Minimum base price per night |
| `maxPrice` | decimal | null | Maximum base price per night |
| `search` | string | null | Search unit name, address, or description |
| `sortBy` | string | `newest` | Safe sort key: `newest`, `price_asc`, `price_desc`; compatibility aliases include `price-asc`, `price-desc`, `cheapest`, `newest_arrivals` |
| `amenityIds` | uuid[] | empty | Repeated or comma-separated amenity IDs. Returned units must contain every selected amenity. |
| `includeInactive` | boolean | true | Include deactivated admins |

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "role": "SuperAdmin | Sales | Finance | Tech",
  "isActive": true,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/admin-users`
**Access:** SuperAdmin
**Description:** Create a new admin user.

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "SuperAdmin | Sales | Finance | Tech"
}
```

**Response `data`:** Single admin user object (same shape as list item).

---

### PATCH `/api/admin-users/{id}/role`
**Access:** SuperAdmin
**Description:** Change the role of an existing admin user.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "role": "SuperAdmin | Sales | Finance | Tech"
}
```

**Response `data`:** Updated admin user object.

---

### PATCH `/api/admin-users/{id}/status`
**Access:** SuperAdmin
**Description:** Activate or deactivate an admin user account.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "isActive": true
}
```

**Response `data`:** Updated admin user object.

---

## 3. Projects

### GET `/api/projects`
**Access:** Public
**Description:** List all projects. By default returns only active projects.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `includeInactive` | boolean | false | Include inactive projects |

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "isActive": true,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/projects`
**Access:** Admin (SuperAdmin)
**Description:** Create a new project.

**Request Body:**
```json
{
  "name": "string",       // required — unique
  "description": "string", // optional
  "isActive": true        // default true
}
```

**Response `data`:** Single project object.

---

### GET `/api/projects/{id}`
**Access:** Public
**Description:** Get a single project by ID.

**Path Parameters:** `id` (uuid)

**Response `data`:** Single project object.

---

### PUT `/api/projects/{id}`
**Access:** Admin
**Description:** Update all fields of a project.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "isActive": true
}
```

**Response `data`:** Updated project object.

---

### PATCH `/api/projects/{id}/status`
**Access:** Admin
**Description:** Toggle project active/inactive status only.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "isActive": false
}
```

**Response `data`:** Updated project object.

---

## 4. Amenities

### GET `/api/amenities`
**Access:** Public
**Description:** List all available amenities (used for unit tagging and public filtering).

**No query parameters.**

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "name": "string",
  "icon": "string | null",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/amenities`
**Access:** SuperAdmin
**Description:** Add a new amenity to the system.

**Request Body:**
```json
{
  "name": "string",   // required — unique
  "icon": "string"    // optional — icon identifier or URL
}
```

**Response `data`:** Single amenity object.

---

## 5. Units

### GET `/api/units`
**Access:** Public
**Description:** List all active units for the public-facing website/app.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page |

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "projectId": "uuid",
  "name": "string",
  "unitType": "string",
  "bedrooms": 0,
  "bathrooms": 0,
  "maxGuests": 0,
  "basePricePerNight": 0,
  "isActive": true,
  "createdAt": "2026-04-26T00:00:00Z",
  "images": [
    {
      "id": "uuid",
      "unitId": "uuid",
      "fileKey": "uploads/units/example.jpg",
      "isCover": true,
      "displayOrder": 0,
      "createdAt": "2026-04-26T00:00:00Z"
    }
  ]
}
```

---

### GET `/api/units/{id}`
**Access:** Public
**Description:** Get full public details of a single unit.

**Path Parameters:** `id` (uuid)

**Response `data`:**
```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "projectId": "uuid",
  "name": "string",
  "description": "string",
  "address": "string",
  "unitType": "string",
  "bedrooms": 0,
  "bathrooms": 0,
  "maxGuests": 0,
  "basePricePerNight": 0,
  "isActive": true,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### GET `/api/internal/units`
**Access:** Admin (all roles)
**Description:** List all units for internal admin use (includes inactive units).

**Query Parameters:** Same as public `GET /api/units`

**Response `data`:** Same shape as public list.

---

### POST `/api/internal/units`
**Access:** Admin (SuperAdmin, Tech)
**Description:** Create a new unit.

**Request Body:**
```json
{
  "ownerId": "uuid",          // required
  "projectId": "uuid",           // required
  "name": "string",           // required
  "description": "string",    // optional
  "address": "string",        // optional
  "unitType": "string",       // required — villa | chalet | studio
  "bedrooms": 0,              // required
  "bathrooms": 0,             // required
  "maxGuests": 0,             // required
  "basePricePerNight": 0,     // required — decimal
  "isActive": true            // default true
}
```

**Response `data`:** Full unit detail object.

---

### GET `/api/internal/units/{id}`
**Access:** Admin (all roles)
**Description:** Get full internal details of a single unit (same as public but accessible regardless of isActive).

**Path Parameters:** `id` (uuid)

**Response `data`:** Same as public detail.

---

### PUT `/api/internal/units/{id}`
**Access:** Admin (SuperAdmin, Tech)
**Description:** Update all editable fields of a unit.

**Path Parameters:** `id` (uuid)

**Request Body:** Same as `POST /api/internal/units`

**Response `data`:** Updated full unit object.

---

### DELETE `/api/internal/units/{id}`
**Access:** SuperAdmin
**Description:** Soft-delete a unit. The record is retained in the DB with `deleted_at` set.

**Path Parameters:** `id` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

### PATCH `/api/internal/units/{id}/status`
**Access:** Admin (SuperAdmin, Tech)
**Description:** Toggle unit active/inactive without updating other fields.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "isActive": false
}
```

**Response `data`:** Updated full unit object.

---

## 6. Unit Images

### GET `/api/units/{unitId}/images`
**Access:** Public
**Description:** Get all images for a unit.

**Path Parameters:** `unitId` (uuid)

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "unitId": "uuid",
  "fileKey": "string",     // cloud storage key — build full URL on frontend
  "isCover": true,
  "displayOrder": 0,
  "createdAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/internal/units/{unitId}/images`
**Access:** Admin
**Description:** Add an image record after the file has been uploaded to cloud storage.

**Path Parameters:** `unitId` (uuid)

**Request Body:**
```json
{
  "fileKey": "string",    // required — key from cloud storage upload
  "isCover": false,       // optional — default false
  "displayOrder": 0       // optional
}
```

**Response `data`:** Single image object.

---

### PUT `/api/internal/units/{unitId}/images/reorder`
**Access:** Admin
**Description:** Update the display order of multiple images in one request.

**Path Parameters:** `unitId` (uuid)

**Request Body:**
```json
{
  "items": [
    { "imageId": "uuid", "displayOrder": 1 },
    { "imageId": "uuid", "displayOrder": 2 }
  ]
}
```

**Response `data`:** Array of all unit images with updated order.

---

### PATCH `/api/internal/units/{unitId}/images/{imageId}/cover`
**Access:** Admin
**Description:** Set a specific image as the cover image. Automatically unsets the previous cover.

**Path Parameters:** `unitId` (uuid), `imageId` (uuid)

**No request body.**

**Response `data`:** Array of all unit images with updated cover status.

---

### DELETE `/api/internal/units/{unitId}/images/{imageId}`
**Access:** Admin
**Description:** Permanently remove an image record from the unit.

**Path Parameters:** `unitId` (uuid), `imageId` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

## 7. Unit Amenities

### GET `/api/units/{unitId}/amenities`
**Access:** Public
**Description:** Get all amenities assigned to a unit.

**Path Parameters:** `unitId` (uuid)

**Response `data`:** Array of:
```json
{
  "amenityId": "uuid",
  "name": "string",
  "icon": "string | null"
}
```

---

### POST `/api/internal/units/{unitId}/amenities`
**Access:** Admin
**Description:** Add a single amenity to a unit.

**Path Parameters:** `unitId` (uuid)

**Request Body:**
```json
{
  "amenityId": "uuid"
}
```

**Response `data`:** `"string"` (confirmation message)

---

### PUT `/api/internal/units/{unitId}/amenities`
**Access:** Admin
**Description:** Replace ALL amenities for a unit in one operation. Send the complete desired list.

**Path Parameters:** `unitId` (uuid)

**Request Body:**
```json
{
  "amenityIds": ["uuid", "uuid", "uuid"]
}
```

**Response `data`:** Array of all amenities now assigned to the unit.

---

### DELETE `/api/internal/units/{unitId}/amenities/{amenityId}`
**Access:** Admin
**Description:** Remove a single amenity from a unit.

**Path Parameters:** `unitId` (uuid), `amenityId` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

## 8. Unit Availability & Pricing

### POST `/api/units/{unitId}/availability/operational-check`
**Access:** Public + Admin
**Description:** Check if a unit is available for a given date range. Returns which specific dates are blocked if unavailable.

**Path Parameters:** `unitId` (uuid)

**Request Body:**
```json
{
  "startDate": "2026-06-01",
  "endDate": "2026-06-05"
}
```

**Response `data`:**
```json
{
  "unitId": "uuid",
  "startDate": "2026-06-01",
  "endDate": "2026-06-05",
  "isAvailable": false,
  "reason": "string",               // e.g., "DateBlocked" or "BookingConflict"
  "blockedDates": ["2026-06-03"]    // specific dates causing the conflict
}
```

---

### POST `/api/units/{unitId}/pricing/calculate`
**Access:** Public + Admin
**Description:** Calculate the total price for a date range, applying seasonal pricing per night where applicable.

**Path Parameters:** `unitId` (uuid)

**Request Body:**
```json
{
  "startDate": "2026-06-01",
  "endDate": "2026-06-05"
}
```

**Response `data`:**
```json
{
  "unitId": "uuid",
  "startDate": "2026-06-01",
  "endDate": "2026-06-05",
  "totalPrice": 2400.00,
  "nights": [
    {
      "date": "2026-06-01",
      "pricePerNight": 600.00,
      "priceSource": "SeasonalPricing | BasePrice"
    }
  ]
}
```

---

## 9. Seasonal Pricing

### GET `/api/internal/units/{unitId}/seasonal-pricing`
**Access:** Admin
**Description:** List all seasonal pricing rules defined for a unit.

**Path Parameters:** `unitId` (uuid)

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "unitId": "uuid",
  "startDate": "2026-06-01",
  "endDate": "2026-08-31",
  "pricePerNight": 800.00,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/internal/units/{unitId}/seasonal-pricing`
**Access:** Admin
**Description:** Create a new seasonal pricing rule for a unit. Date ranges must not overlap.

**Path Parameters:** `unitId` (uuid)

**Request Body:**
```json
{
  "startDate": "2026-06-01",    // required
  "endDate": "2026-08-31",      // required — must be after startDate
  "pricePerNight": 800.00       // required — decimal, > 0
}
```

**Response `data`:** Single seasonal pricing object.

---

### PUT `/api/internal/seasonal-pricing/{id}`
**Access:** Admin
**Description:** Update an existing seasonal pricing rule.

**Path Parameters:** `id` (uuid)

**Request Body:** Same as POST.

**Response `data`:** Updated seasonal pricing object.

---

### DELETE `/api/internal/seasonal-pricing/{id}`
**Access:** Admin
**Description:** Remove a seasonal pricing rule.

**Path Parameters:** `id` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

## 10. Date Blocks

### GET `/api/internal/units/{unitId}/date-blocks`
**Access:** Admin
**Description:** List all date blocks (maintenance, owner use, etc.) for a unit.

**Path Parameters:** `unitId` (uuid)

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "unitId": "uuid",
  "startDate": "2026-05-10",
  "endDate": "2026-05-15",
  "reason": "Maintenance | OwnerUse | Other",
  "notes": "string | null",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/internal/units/{unitId}/date-blocks`
**Access:** Admin
**Description:** Block a date range on a unit to prevent bookings.

**Path Parameters:** `unitId` (uuid)

**Request Body:**
```json
{
  "startDate": "2026-05-10",                    // required
  "endDate": "2026-05-15",                      // required
  "reason": "Maintenance | OwnerUse | Other",   // required
  "notes": "string"                             // optional
}
```

**Response `data`:** Single date block object.

---

### PUT `/api/internal/date-blocks/{id}`
**Access:** Admin
**Description:** Update an existing date block.

**Path Parameters:** `id` (uuid)

**Request Body:** Same as POST.

**Response `data`:** Updated date block object.

---

### DELETE `/api/internal/date-blocks/{id}`
**Access:** Admin
**Description:** Remove a date block. The dates become available again.

**Path Parameters:** `id` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

## 11. Owners

### GET `/api/owners`
**Access:** Admin (SuperAdmin, Sales, Finance)
**Description:** List all property owners.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page |
| `includeInactive` | boolean | true | Include inactive owners |

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "name": "string",
  "phone": "string",
  "email": "string | null",
  "commissionRate": 20.00,
  "status": "active | inactive",
  "createdAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/owners`
**Access:** SuperAdmin
**Description:** Create a new owner account.

**Request Body:**
```json
{
  "name": "string",           // required
  "phone": "string",          // required — unique
  "email": "string",          // optional
  "commissionRate": 20.00,    // required — 0 to 100
  "notes": "string",          // optional
  "status": "active"          // required — active | inactive
}
```

**Response `data`:** Full owner detail object.

---

### GET `/api/owners/{id}`
**Access:** Admin
**Description:** Get full details of a single owner.

**Path Parameters:** `id` (uuid)

**Response `data`:**
```json
{
  "id": "uuid",
  "name": "string",
  "phone": "string",
  "email": "string | null",
  "commissionRate": 20.00,
  "notes": "string | null",
  "status": "active | inactive",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### PUT `/api/owners/{id}`
**Access:** SuperAdmin
**Description:** Update all editable fields of an owner.

**Path Parameters:** `id` (uuid)

**Request Body:** Same as POST.

**Response `data`:** Updated full owner object.

---

### PATCH `/api/owners/{id}/status`
**Access:** SuperAdmin
**Description:** Change owner status only (activate or deactivate).

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "status": "active | inactive"
}
```

**Response `data`:** Updated full owner object.

---

## 12. Clients

### GET `/api/clients`
**Access:** Admin (SuperAdmin, Sales)
**Description:** List all registered clients.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page |
| `includeInactive` | boolean | false | Include deactivated clients |

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "name": "string",
  "phone": "string",
  "email": "string | null",
  "isActive": true,
  "createdAt": "2026-04-26T00:00:00Z"
}
```

---

### GET `/api/clients/{id}`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Get full details of a single client.

**Path Parameters:** `id` (uuid)

**Response `data`:**
```json
{
  "id": "uuid",
  "name": "string",
  "phone": "string",
  "email": "string | null",
  "isActive": true,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

## 13. CRM Leads

### POST `/api/crm/leads`
**Access:** Public (submitted by end users from booking form)
**Description:** Create a new CRM lead. This is the public booking request endpoint. No auth required — client may or may not have an account yet.

**Request Body:**
```json
{
  "clientId": "uuid",                     // optional — if client is logged in
  "targetUnitId": "uuid",                 // optional — unit they're interested in
  "contactName": "string",                // required if no clientId
  "contactPhone": "string",               // required if no clientId
  "contactEmail": "string",               // optional
  "desiredCheckInDate": "2026-06-01",     // optional
  "desiredCheckOutDate": "2026-06-05",    // optional
  "guestCount": 2,                        // optional
  "source": "Website | App | WhatsApp | PhoneCall | Referral",
  "notes": "string"                       // optional — client message
}
```

**Response `data`:**
```json
{
  "id": "uuid",
  "clientId": "uuid | null",
  "targetUnitId": "uuid | null",
  "assignedAdminUserId": "uuid | null",
  "contactName": "string",
  "contactPhone": "string",
  "contactEmail": "string | null",
  "desiredCheckInDate": "2026-06-01",
  "desiredCheckOutDate": "2026-06-05",
  "guestCount": 2,
  "leadStatus": "Prospecting",
  "source": "Website",
  "notes": "string | null",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### GET `/api/internal/crm/leads`
**Access:** Admin (SuperAdmin, Sales)
**Description:** List all CRM leads with optional filters. Used to populate the CRM pipeline board.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `leadStatus` | string | — | Filter by status |
| `assignedAdminUserId` | uuid | — | Filter by assigned sales person |
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page |

**Lead Status Values:** `Prospecting | Relevant | NoAnswer | NotRelevant | Booked | Confirmed | CheckIn | Completed | Cancelled | LeftEarly`

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "clientId": "uuid | null",
  "targetUnitId": "uuid | null",
  "assignedAdminUserId": "uuid | null",
  "contactName": "string",
  "contactPhone": "string",
  "contactEmail": "string | null",
  "desiredCheckInDate": "2026-06-01",
  "desiredCheckOutDate": "2026-06-05",
  "guestCount": 2,
  "leadStatus": "Prospecting",
  "source": "Website",
  "createdAt": "2026-04-26T00:00:00Z"
}
```

---

### GET `/api/internal/crm/leads/{id}`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Get full details of a single lead including notes field.

**Path Parameters:** `id` (uuid)

**Response `data`:** Same as list item + `notes` field + `updatedAt`.

---

### PUT `/api/internal/crm/leads/{id}`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Update all editable fields of a lead (contact info, dates, unit, assignment, notes).

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "clientId": "uuid",
  "targetUnitId": "uuid",
  "assignedAdminUserId": "uuid",
  "contactName": "string",
  "contactPhone": "string",
  "contactEmail": "string",
  "desiredCheckInDate": "2026-06-01",
  "desiredCheckOutDate": "2026-06-05",
  "guestCount": 2,
  "source": "string",
  "notes": "string"
}
```

**Response `data`:** Full updated lead object.

---

### PATCH `/api/internal/crm/leads/{id}/status`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Transition a lead to a new status. Only valid transitions are accepted.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "leadStatus": "Relevant"
}
```

**Response `data`:** Updated lead object with new status.

> **Valid Transitions:**
> - Prospecting → Relevant | NoAnswer | NotRelevant
> - Relevant → Booked | NoAnswer | NotRelevant
> - NoAnswer → Relevant | NotRelevant
> - Booked → Confirmed | NotRelevant
> - Confirmed → CheckIn | Cancelled
> - CheckIn → Completed | LeftEarly

---

### POST `/api/internal/crm/leads/{id}/convert-to-booking`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Convert a CRM lead into a formal booking. Creates a Booking record linked to this lead.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "clientId": "uuid",         // required
  "unitId": "uuid",           // required — confirmed unit
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-05",
  "guestCount": 2,
  "internalNotes": "string"   // optional
}
```

**Response `data`:** The newly created Booking object.

---

## 14. CRM Notes

### GET `/api/internal/crm/leads/{leadId}/notes`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Get all notes for a specific CRM lead.

**Path Parameters:** `leadId` (uuid)

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "bookingId": "uuid | null",
  "crmLeadId": "uuid",
  "createdByAdminUserId": "uuid",
  "noteText": "string",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/internal/crm/leads/{leadId}/notes`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Add a new note to a CRM lead.

**Path Parameters:** `leadId` (uuid)

**Request Body:**
```json
{
  "noteText": "string"    // required
}
```

**Response `data`:** Single note object.

---

### GET `/api/internal/bookings/{bookingId}/notes`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Get all notes for a specific booking.

**Path Parameters:** `bookingId` (uuid)

**Response `data`:** Same shape as lead notes.

---

### POST `/api/internal/bookings/{bookingId}/notes`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Add a new note to a booking.

**Path Parameters:** `bookingId` (uuid)

**Request Body:**
```json
{
  "noteText": "string"
}
```

**Response `data`:** Single note object.

---

### PUT `/api/internal/crm/notes/{id}`
**Access:** Admin (note creator only, or SuperAdmin)
**Description:** Edit the text of an existing note.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "noteText": "string"
}
```

**Response `data`:** Updated note object.

---

### DELETE `/api/internal/crm/notes/{id}`
**Access:** Admin (SuperAdmin)
**Description:** Delete a note permanently.

**Path Parameters:** `id` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

## 15. CRM Assignments

### GET `/api/internal/crm/leads/{leadId}/assignment`
**Access:** Admin
**Description:** Get the current sales person assigned to a lead.

**Path Parameters:** `leadId` (uuid)

**Response `data`:**
```json
{
  "id": "uuid",
  "bookingId": "uuid | null",
  "crmLeadId": "uuid",
  "assignedAdminUserId": "uuid",
  "isActive": true,
  "assignedAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/internal/crm/leads/{leadId}/assignment`
**Access:** Admin (SuperAdmin)
**Description:** Assign or reassign a lead to a sales admin user.

**Path Parameters:** `leadId` (uuid)

**Request Body:**
```json
{
  "assignedAdminUserId": "uuid"
}
```

**Response `data`:** Assignment object.

---

### DELETE `/api/internal/crm/leads/{leadId}/assignment`
**Access:** Admin (SuperAdmin)
**Description:** Remove the current assignment from a lead.

**Path Parameters:** `leadId` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

### GET `/api/internal/bookings/{bookingId}/assignment`
**Access:** Admin
**Description:** Get the current assignment for a booking.

**Path Parameters:** `bookingId` (uuid)

**Response `data`:** Same as lead assignment shape.

---

### POST `/api/internal/bookings/{bookingId}/assignment`
**Access:** Admin (SuperAdmin)
**Description:** Assign a booking to a sales admin user.

**Path Parameters:** `bookingId` (uuid)

**Request Body:**
```json
{
  "assignedAdminUserId": "uuid"
}
```

**Response `data`:** Assignment object.

---

### DELETE `/api/internal/bookings/{bookingId}/assignment`
**Access:** Admin (SuperAdmin)
**Description:** Remove the assignment from a booking.

**Path Parameters:** `bookingId` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

## 16. Bookings

### GET `/api/internal/bookings`
**Access:** Admin (SuperAdmin, Sales)
**Description:** List all bookings with optional filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `bookingStatus` | string | — | Filter by status |
| `assignedAdminUserId` | uuid | — | Filter by assigned sales person |
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page |

**Booking Status Values:** `Pending | Confirmed | CheckIn | Completed | Cancelled | LeftEarly`

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "clientId": "uuid",
  "unitId": "uuid",
  "ownerId": "uuid",
  "assignedAdminUserId": "uuid | null",
  "bookingStatus": "string",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-05",
  "guestCount": 2,
  "baseAmount": 2000.00,
  "finalAmount": 2400.00,
  "source": "string",
  "createdAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/internal/bookings`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Create a booking directly from the admin panel (not from public form).

**Request Body:**
```json
{
  "clientId": "uuid",               // required
  "unitId": "uuid",                 // required
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-05",
  "guestCount": 2,
  "source": "string",
  "assignedAdminUserId": "uuid",    // optional
  "internalNotes": "string"         // optional
}
```

**Response `data`:** Full booking detail object.

---

### GET `/api/internal/bookings/{id}`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Get full details of a single booking.

**Path Parameters:** `id` (uuid)

**Response `data`:**
```json
{
  "id": "uuid",
  "clientId": "uuid",
  "unitId": "uuid",
  "ownerId": "uuid",
  "assignedAdminUserId": "uuid | null",
  "bookingStatus": "string",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-05",
  "guestCount": 2,
  "baseAmount": 2000.00,
  "finalAmount": 2400.00,
  "source": "string",
  "internalNotes": "string | null",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### PUT `/api/internal/bookings/{id}`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Update editable fields of a pending booking.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-05",
  "guestCount": 2,
  "source": "string",
  "assignedAdminUserId": "uuid",
  "internalNotes": "string"
}
```

**Response `data`:** Updated full booking object.

---

### GET `/api/internal/bookings/{id}/status-history`
**Access:** Admin
**Description:** Get the full audit trail of status changes for a booking.

**Path Parameters:** `id` (uuid)

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "oldStatus": "Pending",
  "newStatus": "Confirmed",
  "changedByAdminUserId": "uuid",
  "notes": "string | null",
  "changedAt": "2026-04-26T00:00:00Z"
}
```

---

## 17. Booking Lifecycle

### POST `/api/internal/bookings/{id}/confirm`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Confirm a booking. Triggers invoice generation and client notification.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — reason or confirmation message
}
```

**Response `data`:** Updated booking object with status `"Confirmed"`.

---

### POST `/api/internal/bookings/{id}/cancel`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Cancel a booking. If cancelled after confirmation, deposit is non-refundable by default.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — cancellation reason
}
```

**Response `data`:** Updated booking object with status `"Cancelled"`.

---

### POST `/api/internal/bookings/{id}/complete`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Manually mark a booking as completed. Usually triggered automatically by background job after check-out date.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional
}
```

**Response `data`:** Updated booking object with status `"Completed"`.

---

## 18. Payments

### GET `/api/internal/payments`
**Access:** Admin (SuperAdmin, Finance, Sales)
**Description:** List all payments with optional filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `paymentStatus` | string | — | Filter by status |
| `bookingId` | uuid | — | Filter by booking |
| `invoiceId` | uuid | — | Filter by invoice |
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page |

**Payment Status Values:** `Pending | Paid | Failed | Cancelled`

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "invoiceId": "uuid | null",
  "paymentStatus": "Pending | Paid | Failed | Cancelled",
  "paymentMethod": "InstaPay | VodafoneCash | Cash | BankTransfer",
  "amount": 500.00,
  "referenceNumber": "string | null",
  "notes": "string | null",
  "paidAt": "2026-04-26T00:00:00Z | null",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/internal/payments`
**Access:** Admin (SuperAdmin, Sales, Finance)
**Description:** Record a new payment for a booking. Manually entered after receiving payment via external method.

**Request Body:**
```json
{
  "bookingId": "uuid",          // required
  "invoiceId": "uuid",          // optional — link to specific invoice
  "paymentMethod": "string",    // required
  "amount": 500.00,             // required — must be > 0
  "referenceNumber": "string",  // optional — external transfer reference
  "notes": "string"             // optional
}
```

**Response `data`:** Single payment object.

---

### GET `/api/internal/payments/{id}`
**Access:** Admin
**Description:** Get details of a single payment.

**Path Parameters:** `id` (uuid)

**Response `data`:** Single payment object (same shape as list item).

---

### POST `/api/internal/payments/{id}/mark-paid`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Mark a pending payment as paid.

**Path Parameters:** `id` (uuid)

**No request body.**

**Response `data`:** Updated payment object with `paymentStatus: "Paid"`.

---

### POST `/api/internal/payments/{id}/mark-failed`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Mark a payment as failed with optional notes.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — reason for failure
}
```

**Response `data`:** Updated payment object with `paymentStatus: "Failed"`.

---

### POST `/api/internal/payments/{id}/cancel`
**Access:** Admin (SuperAdmin)
**Description:** Cancel a payment record.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional
}
```

**Response `data`:** Updated payment object with `paymentStatus: "Cancelled"`.

---

## 19. Invoices

### GET `/api/internal/invoices`
**Access:** Admin (Finance, SuperAdmin, Sales)
**Description:** List invoices with optional filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `invoiceStatus` | string | — | Filter by invoice status |
| `bookingId` | uuid | — | Filter by booking |
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page |

**Invoice Status Values:** `Draft | Issued | Cancelled`

**Response `data`:** Array of invoice objects (see detail below).

---

### GET `/api/internal/invoices/{id}`
**Access:** Admin
**Description:** Get full details of a single invoice including line items.

**Path Parameters:** `id` (uuid)

**Response `data`:**
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "invoiceNumber": "INV-202606-00001",
  "invoiceStatus": "Issued",
  "subtotalAmount": 2400.00,
  "totalAmount": 2400.00,
  "issuedAt": "2026-04-26T00:00:00Z | null",
  "dueDate": "2026-06-01",
  "notes": "string | null",
  "items": [
    {
      "id": "uuid",
      "invoiceId": "uuid",
      "lineType": "Accommodation | ManualAdjustment",
      "description": "string",
      "quantity": 5,
      "unitAmount": 480.00,
      "lineTotal": 2400.00,
      "createdAt": "2026-04-26T00:00:00Z",
      "updatedAt": "2026-04-26T00:00:00Z"
    }
  ],
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### POST `/api/internal/invoices/drafts`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Create a draft invoice for a booking. Line items auto-calculated from booking pricing.

**Request Body:**
```json
{
  "bookingId": "uuid",          // required
  "invoiceNumber": "string",    // optional — auto-generated if not provided
  "notes": "string"             // optional
}
```

**Response `data`:** Full invoice object with status `"Draft"`.

---

### POST `/api/internal/invoices/{id}/items/manual-adjustment`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Add a manual adjustment line item to a draft invoice (e.g., discount, extra fee).

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "description": "string",    // required — e.g., "Early bird discount"
  "quantity": 1,              // required
  "unitAmount": -200.00       // required — negative for discounts
}
```

**Response `data`:** Updated full invoice object.

---

### POST `/api/internal/invoices/{id}/issue`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Issue (finalize) a draft invoice. Status changes to `Issued`. No more edits allowed after this.

**Path Parameters:** `id` (uuid)

**No request body.**

**Response `data`:** Updated invoice object with status `"Issued"`.

---

### POST `/api/internal/invoices/{id}/cancel`
**Access:** Admin (SuperAdmin)
**Description:** Cancel an issued invoice.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — cancellation reason
}
```

**Response `data`:** Updated invoice object with status `"Cancelled"`.

---

## 20. Finance Summary

### GET `/api/internal/invoices/{invoiceId}/balance`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Get the payment balance status of a specific invoice.

**Path Parameters:** `invoiceId` (uuid)

**Response `data`:**
```json
{
  "invoiceId": "uuid",
  "totalAmount": 2400.00,
  "paidAmount": 500.00,
  "remainingAmount": 1900.00,
  "isFullyPaid": false
}
```

---

### GET `/api/internal/bookings/{bookingId}/finance-snapshot`
**Access:** Admin (Finance, SuperAdmin, Sales)
**Description:** Get a combined financial overview of a booking: invoice + payout status.

**Path Parameters:** `bookingId` (uuid)

**Response `data`:**
```json
{
  "bookingId": "uuid",
  "invoiceId": "uuid | null",
  "invoiceStatus": "Draft | Issued | Cancelled | null",
  "invoicedAmount": 2400.00,
  "paidAmount": 500.00,
  "remainingAmount": 1900.00,
  "ownerPayoutStatus": "Pending | Scheduled | Paid | Cancelled | null"
}
```

---

### GET `/api/internal/owners/{ownerId}/payout-summary`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Get aggregated payout amounts for an owner across all their bookings.

**Path Parameters:** `ownerId` (uuid)

**Response `data`:**
```json
{
  "ownerId": "uuid",
  "totalPending": 5000.00,
  "totalScheduled": 2000.00,
  "totalPaid": 12000.00
}
```

---

## 21. Owner Payouts

### GET `/api/internal/owner-payouts/by-booking/{bookingId}`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Get the payout record associated with a specific booking.

**Path Parameters:** `bookingId` (uuid)

**Response `data`:**
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "ownerId": "uuid",
  "payoutStatus": "Pending | Scheduled | Paid | Cancelled",
  "grossBookingAmount": 2400.00,
  "commissionRate": 20.00,
  "commissionAmount": 480.00,
  "payoutAmount": 1920.00,
  "scheduledAt": "2026-05-01T00:00:00Z | null",
  "paidAt": "2026-05-01T00:00:00Z | null",
  "notes": "string | null",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### GET `/api/internal/owners/{ownerId}/payouts`
**Access:** Admin (Finance, SuperAdmin)
**Description:** List all payout records for a specific owner.

**Path Parameters:** `ownerId` (uuid)

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `payoutStatus` | string | — | Filter by payout status |

**Response `data`:** Array of payout objects.

---

### POST `/api/internal/owner-payouts`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Create a payout record for a booking. Calculates amounts based on commission rate.

**Request Body:**
```json
{
  "bookingId": "uuid",      // required
  "commissionRate": 20.00,  // required — override if different from owner default
  "notes": "string"         // optional
}
```

**Response `data`:** Single payout object.

---

### POST `/api/internal/owner-payouts/{id}/schedule`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Mark a payout as scheduled for payment.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional
}
```

**Response `data`:** Updated payout object with status `"Scheduled"`.

---

### POST `/api/internal/owner-payouts/{id}/mark-paid`
**Access:** Admin (Finance, SuperAdmin)
**Description:** Mark a payout as paid after transferring the money to the owner.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — e.g., "Transferred via InstaPay ref #12345"
}
```

**Response `data`:** Updated payout object with status `"Paid"`.

---

### POST `/api/internal/owner-payouts/{id}/cancel`
**Access:** Admin (SuperAdmin)
**Description:** Cancel a payout record.

**Path Parameters:** `id` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — cancellation reason
}
```

**Response `data`:** Updated payout object with status `"Cancelled"`.

---

## 22. Reviews — Client

### POST `/api/client/reviews`
**Access:** Authenticated Client
**Description:** Submit a review for a completed booking. Only allowed if booking status is `Completed` and no review exists yet.

**Request Body:**
```json
{
  "bookingId": "uuid",    // required — must be a completed booking belonging to this client
  "rating": 4,            // required — integer 1 to 5
  "title": "string",      // required
  "comment": "string"     // optional
}
```

**Response `data`:**
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "unitId": "uuid",
  "clientId": "uuid",
  "ownerId": "uuid",
  "rating": 4,
  "title": "string",
  "comment": "string | null",
  "reviewStatus": "Pending",
  "submittedAt": "2026-04-26T00:00:00Z",
  "publishedAt": null,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### PUT `/api/client/reviews/{reviewId}`
**Access:** Authenticated Client (review owner)
**Description:** Edit a review before it's published.

**Path Parameters:** `reviewId` (uuid)

**Request Body:**
```json
{
  "rating": 5,
  "title": "string",
  "comment": "string"
}
```

**Response `data`:** Updated review object.

---

### GET `/api/client/reviews/by-booking/{bookingId}`
**Access:** Authenticated Client
**Description:** Get the review submitted for a specific booking by the current client.

**Path Parameters:** `bookingId` (uuid)

**Response `data`:** Single review object.

---

## 23. Reviews — Public

### GET `/api/public/units/{unitId}/reviews/summary`
**Access:** Public
**Description:** Get the aggregated rating summary for a unit (avg rating + count).

**Path Parameters:** `unitId` (uuid)

**Response `data`:**
```json
{
  "unitId": "uuid",
  "publishedReviewCount": 24,
  "averageRating": 4.7,
  "lastReviewPublishedAt": "2026-04-20T00:00:00Z"
}
```

---

### GET `/api/public/units/{unitId}/reviews`
**Access:** Public
**Description:** List all published reviews for a unit. Includes owner reply if present.

**Path Parameters:** `unitId` (uuid)

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Page` | integer | 1 | Page number |
| `PageSize` | integer | 20 | Items per page |

**Response `data`:** Array of:
```json
{
  "reviewId": "uuid",
  "unitId": "uuid",
  "rating": 5,
  "title": "string",
  "comment": "string | null",
  "publishedAt": "2026-04-20T00:00:00Z",
  "ownerReplyText": "string | null",
  "ownerReplyUpdatedAt": "2026-04-21T00:00:00Z | null"
}
```

---

### GET `/api/public/units/{unitId}/reviews/{reviewId}`
**Access:** Public
**Description:** Get a single published review.

**Path Parameters:** `unitId` (uuid), `reviewId` (uuid)

**Response `data`:** Single published review object.

---

## 24. Reviews — Moderation (Admin)

### POST `/api/internal/reviews/{reviewId}/publish`
**Access:** Admin (SuperAdmin)
**Description:** Publish a pending review so it appears publicly on the unit page.

**Path Parameters:** `reviewId` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — moderation note
}
```

**Response `data`:** Updated review object with `reviewStatus: "Published"`.

---

### POST `/api/internal/reviews/{reviewId}/reject`
**Access:** Admin (SuperAdmin)
**Description:** Reject a review (does not appear publicly).

**Path Parameters:** `reviewId` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — rejection reason
}
```

**Response `data`:** Updated review object with `reviewStatus: "Rejected"`.

---

### POST `/api/internal/reviews/{reviewId}/hide`
**Access:** Admin (SuperAdmin)
**Description:** Hide a previously published review.

**Path Parameters:** `reviewId` (uuid)

**Request Body:**
```json
{
  "notes": "string"    // optional — reason for hiding
}
```

**Response `data`:** Updated review object with `reviewStatus: "Hidden"`.

---

### GET `/api/internal/reviews/{reviewId}/status-history`
**Access:** Admin
**Description:** Get the moderation audit trail for a review.

**Path Parameters:** `reviewId` (uuid)

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "reviewId": "uuid",
  "oldStatus": "Pending",
  "newStatus": "Published",
  "changedByAdminUserId": "uuid",
  "notes": "string | null",
  "changedAt": "2026-04-26T00:00:00Z"
}
```

---

## 25. Review Replies (Owner)

### GET `/api/owner/reviews/{reviewId}/reply`
**Access:** Authenticated Owner
**Description:** Get the owner's reply to a specific review.

**Path Parameters:** `reviewId` (uuid)

**Response `data`:**
```json
{
  "id": "uuid",
  "reviewId": "uuid",
  "ownerId": "uuid",
  "replyText": "string",
  "isVisible": true,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### PUT `/api/owner/reviews/{reviewId}/reply`
**Access:** Authenticated Owner
**Description:** Create or update the owner's reply to a review.

**Path Parameters:** `reviewId` (uuid)

**Request Body:**
```json
{
  "replyText": "string",    // required
  "isVisible": true          // optional — default true
}
```

**Response `data`:** Reply object.

---

### DELETE `/api/owner/reviews/{reviewId}/reply`
**Access:** Authenticated Owner
**Description:** Delete the owner's reply to a review.

**Path Parameters:** `reviewId` (uuid)

**Response `data`:** `"string"` (confirmation message)

---

### PATCH `/api/owner/reviews/{reviewId}/reply/visibility`
**Access:** Authenticated Owner
**Description:** Toggle the visibility of an existing reply without changing its text.

**Path Parameters:** `reviewId` (uuid)

**Request Body:**
```json
{
  "isVisible": false
}
```

**Response `data`:** Updated reply object.

---

## 26. Owner Portal — Dashboard

### GET `/api/owner/dashboard`
**Access:** Authenticated Owner
**Description:** Get a summary of the owner's portfolio and financial overview.

**No parameters.**

**Response `data`:**
```json
{
  "ownerId": "uuid",
  "totalUnits": 3,
  "activeUnits": 3,
  "totalBookings": 45,
  "confirmedBookings": 5,
  "completedBookings": 38,
  "totalPaidAmount": 86400.00,
  "totalPendingPayoutAmount": 7200.00,
  "totalPaidPayoutAmount": 69120.00
}
```

---

## 27. Owner Portal — Units

### GET `/api/owner/units`
**Access:** Authenticated Owner
**Description:** List only the units belonging to the authenticated owner.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `IsActive` | boolean | — | Filter by active status |
| `ProjectId` | uuid | — | Filter by project |
| `Page` | integer | — | Page number |
| `PageSize` | integer | — | Items per page |

**Response `data`:** Array of:
```json
{
  "unitId": "uuid",
  "projectId": "uuid",
  "unitName": "string",
  "unitType": "string",
  "isActive": true,
  "bedrooms": 2,
  "bathrooms": 1,
  "maxGuests": 4,
  "basePricePerNight": 600.00,
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### GET `/api/owner/units/{unitId}`
**Access:** Authenticated Owner
**Description:** Get details of a single unit owned by the authenticated owner.

**Path Parameters:** `unitId` (uuid)

**Response `data`:** Single unit object (same shape as list).

> **Note:** Owner cannot edit units. View-only access.

---

## 28. Owner Portal — Bookings

### GET `/api/owner/bookings`
**Access:** Authenticated Owner
**Description:** List bookings for the owner's units. Shows only confirmed and above.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `BookingStatus` | string | — | Filter by status |
| `CheckInFrom` | date | — | Filter bookings with check-in from this date |
| `CheckInTo` | date | — | Filter bookings with check-in to this date |
| `Page` | integer | — | Page number |
| `PageSize` | integer | — | Items per page |

**Response `data`:** Array of:
```json
{
  "bookingId": "uuid",
  "unitId": "uuid",
  "clientId": "uuid",
  "assignedAdminUserId": "uuid | null",
  "bookingStatus": "string",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-05",
  "guestCount": 2,
  "finalAmount": 2400.00,
  "source": "string",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### GET `/api/owner/bookings/{bookingId}`
**Access:** Authenticated Owner
**Description:** Get details of a single booking on the owner's units.

**Path Parameters:** `bookingId` (uuid)

**Response `data`:** Single booking object (same shape as list).

---

## 29. Owner Portal — Finance

### GET `/api/owner/finance`
**Access:** Authenticated Owner
**Description:** List per-booking financial rows for the owner.

**No query parameters documented.**

**Response `data`:** Array of `OwnerPortalFinanceRowResponse` (per-booking finance row).

---

### GET `/api/owner/finance/bookings/{bookingId}`
**Access:** Authenticated Owner
**Description:** Get detailed financial breakdown for a specific booking.

**Path Parameters:** `bookingId` (uuid)

**Response `data`:**
```json
{
  "bookingId": "uuid",
  "unitId": "uuid",
  "invoiceId": "uuid | null",
  "invoiceStatus": "string | null",
  "invoicedAmount": 2400.00,
  "paidAmount": 2400.00,
  "remainingAmount": 0.00,
  "payoutId": "uuid | null",
  "payoutStatus": "Paid",
  "payoutAmount": 1920.00,
  "payoutScheduledAt": "2026-05-01T00:00:00Z",
  "payoutPaidAt": "2026-05-03T00:00:00Z"
}
```

---

### GET `/api/owner/finance/summary`
**Access:** Authenticated Owner
**Description:** Get aggregated financial summary for the owner across all bookings.

**No parameters.**

**Response `data`:**
```json
{
  "ownerId": "uuid",
  "totalInvoicedAmount": 96000.00,
  "totalPaidAmount": 86400.00,
  "totalRemainingAmount": 9600.00,
  "totalPendingPayoutAmount": 7200.00,
  "totalScheduledPayoutAmount": 0.00,
  "totalPaidPayoutAmount": 69120.00
}
```

---

## 30. Notifications — Internal (Admin)

### POST `/api/internal/notifications/admins/{adminUserId}`
**Access:** Admin (SuperAdmin)
**Description:** Send a notification to a specific admin user.

**Path Parameters:** `adminUserId` (uuid)

**Request Body:**
```json
{
  "templateCode": "string",     // required — notification template identifier
  "channel": "Email | InApp",   // required
  "variables": {                // optional — template variable substitutions
    "key": "value"
  },
  "scheduledAt": "2026-04-26T10:00:00Z"   // optional — schedule for future delivery
}
```

**Response `data`:** Notification object (see shape below).

---

### POST `/api/internal/notifications/clients/{clientId}`
**Access:** Admin (SuperAdmin, Sales)
**Description:** Send a notification to a specific client.

**Path Parameters:** `clientId` (uuid)

**Request Body:** Same as admin notification.

**Response `data`:** Notification object.

---

### POST `/api/internal/notifications/owners/{ownerId}`
**Access:** Admin
**Description:** Send a notification to a specific owner.

**Path Parameters:** `ownerId` (uuid)

**Request Body:** Same as admin notification.

**Response `data`:**
```json
{
  "id": "uuid",
  "templateId": "uuid",
  "adminUserId": "uuid | null",
  "clientId": "uuid | null",
  "ownerId": "uuid | null",
  "channel": "Email | InApp | SMS",
  "notificationStatus": "Pending | Queued | Sent | Delivered | Failed | Cancelled",
  "subject": "string",
  "body": "string",
  "scheduledAt": "2026-04-26T10:00:00Z | null",
  "sentAt": "2026-04-26T10:01:00Z | null",
  "readAt": "2026-04-26T10:05:00Z | null",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### GET `/api/internal/notifications/{notificationId}`
**Access:** Admin
**Description:** Get details of a specific notification.

**Path Parameters:** `notificationId` (uuid)

**Response `data`:** Single notification object.

---

### GET `/api/internal/notifications`
**Access:** Admin
**Description:** List all notifications with filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `NotificationStatus` | string | — | Filter by delivery status |
| `Channel` | string | — | Filter by channel |
| `TemplateId` | uuid | — | Filter by template |
| `Page` | integer | — | Page number |
| `PageSize` | integer | — | Items per page |

**Response `data`:** Array of notification objects.

---

## 31. Notifications — Dispatch

### POST `/api/internal/notifications/{notificationId}/queue`
**Access:** Admin
**Description:** Move a notification to the delivery queue.

**Path Parameters:** `notificationId` (uuid)

**Request Body:** `{}` (empty)

**Response `data`:** Updated notification with status `"Queued"`.

---

### POST `/api/internal/notifications/{notificationId}/mark-sent`
**Access:** Admin / System
**Description:** Mark notification as sent by the delivery provider.

**Path Parameters:** `notificationId` (uuid)

**Request Body:**
```json
{
  "providerName": "string",         // e.g., "SendGrid"
  "providerMessageId": "string"     // external message ID for tracking
}
```

**Response `data`:** Updated notification.

---

### POST `/api/internal/notifications/{notificationId}/mark-delivered`
**Access:** Admin / System
**Description:** Mark notification as confirmed delivered.

**Path Parameters:** `notificationId` (uuid)

**Request Body:** Same as mark-sent.

**Response `data`:** Updated notification.

---

### POST `/api/internal/notifications/{notificationId}/mark-failed`
**Access:** Admin / System
**Description:** Mark notification as failed with error details.

**Path Parameters:** `notificationId` (uuid)

**Request Body:**
```json
{
  "errorMessage": "string",
  "providerName": "string",
  "providerMessageId": "string"
}
```

**Response `data`:** Updated notification with status `"Failed"`.

---

### POST `/api/internal/notifications/{notificationId}/cancel`
**Access:** Admin
**Description:** Cancel a scheduled notification before it's sent.

**Path Parameters:** `notificationId` (uuid)

**Request Body:** `{}` (empty)

**Response `data`:** Updated notification with status `"Cancelled"`.

---

### GET `/api/internal/notifications/{notificationId}/delivery-logs`
**Access:** Admin
**Description:** Get delivery attempt logs for a notification (useful for debugging failed sends).

**Path Parameters:** `notificationId` (uuid)

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "notificationId": "uuid",
  "attemptNumber": 1,
  "deliveryStatus": "string",
  "providerName": "string",
  "providerMessageId": "string",
  "errorMessage": "string | null",
  "attemptedAt": "2026-04-26T00:00:00Z"
}
```

---

## 32. Notification Inbox

> **Pattern:** All three user types (admin, client, owner) have identical inbox endpoints under their respective prefixes (`/api/internal/me/`, `/api/client/me/`, `/api/owner/me/`).

### GET `/{prefix}/notifications/inbox`
**Access:** Authenticated user (respective type)
**Description:** Get the notification inbox for the current user.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `UnreadOnly` | boolean | Show only unread notifications |
| `Page` | integer | Page number |
| `PageSize` | integer | Items per page |

**Response `data`:** Array of:
```json
{
  "notificationId": "uuid",
  "channel": "string",
  "notificationStatus": "string",
  "subject": "string",
  "body": "string",
  "createdAt": "2026-04-26T00:00:00Z",
  "sentAt": "2026-04-26T00:00:00Z",
  "readAt": "2026-04-26T00:00:00Z | null"
}
```

---

### GET `/{prefix}/notifications/inbox/summary`
**Access:** Authenticated user
**Description:** Get unread notification count for the notification bell badge.

**No parameters.**

**Response `data`:**
```json
{
  "totalCount": 15,
  "unreadCount": 3
}
```

---

### POST `/{prefix}/notifications/inbox/{notificationId}/read`
**Access:** Authenticated user
**Description:** Mark a specific notification as read.

**Path Parameters:** `notificationId` (uuid)

**Response `data`:** Updated notification object.

**Prefixes:**
- Admin: `/api/internal/me/`
- Client: `/api/client/me/`
- Owner: `/api/owner/me/`

---

## 33. Notification Preferences

> **Pattern:** All three user types have identical preference endpoints.

### GET `/{prefix}/notification-preferences`
**Access:** Authenticated user
**Description:** Get notification preferences for the current user.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `channel` | string | Filter by channel (Email, InApp, SMS) |

**Response `data`:** Array of:
```json
{
  "id": "uuid",
  "adminUserId": "uuid | null",
  "clientId": "uuid | null",
  "ownerId": "uuid | null",
  "channel": "Email | InApp | SMS",
  "preferenceKey": "string",    // e.g., "BookingConfirmed", "NewLead"
  "isEnabled": true,
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

---

### PUT `/{prefix}/notification-preferences`
**Access:** Authenticated user
**Description:** Update a single notification preference.

**Request Body:**
```json
{
  "channel": "Email",
  "preferenceKey": "BookingConfirmed",
  "isEnabled": false
}
```

**Response `data`:** Updated preference object.

**Prefixes:**
- Admin: `/api/internal/me/`
- Client: `/api/client/me/`
- Owner: `/api/owner/me/`

---

## 34. Reporting — Bookings Analytics

### GET `/api/internal/reports/bookings/daily`
**Access:** Admin (SuperAdmin, Finance)
**Description:** Get day-by-day booking metrics for a date range.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `DateFrom` | date | Start of range |
| `DateTo` | date | End of range |
| `BookingSource` | string | Filter by source |
| `Page` | integer | Page number |
| `PageSize` | integer | Items per page |

**Response `data`:** Array of:
```json
{
  "metricDate": "2026-04-26",
  "bookingSource": "Website",
  "bookingsCreatedCount": 5,
  "prospectingBookingsCount": 2,
  "confirmedBookingsCount": 2,
  "cancelledBookingsCount": 0,
  "completedBookingsCount": 1,
  "totalFinalAmount": 12000.00
}
```

---

### GET `/api/internal/reports/bookings/summary`
**Access:** Admin (SuperAdmin, Finance)
**Description:** Get aggregated booking totals for a date range.

**Query Parameters:** Same as daily.

**Response `data`:**
```json
{
  "dateFrom": "2026-04-01",
  "dateTo": "2026-04-30",
  "bookingSource": "string | null",
  "totalBookingsCreatedCount": 42,
  "totalProspectingBookingsCount": 3,
  "totalConfirmedBookingsCount": 12,
  "totalCancelledBookingsCount": 2,
  "totalCompletedBookingsCount": 25,
  "totalFinalAmount": 201600.00
}
```

---

## 35. Reporting — Finance Analytics

### GET `/api/internal/reports/finance/daily`
**Access:** Admin (SuperAdmin, Finance)
**Description:** Get day-by-day financial metrics for a date range.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `DateFrom` | date | Start of range |
| `DateTo` | date | End of range |
| `Page` | integer | Page number |
| `PageSize` | integer | Items per page |

**Response `data`:** Array of:
```json
{
  "metricDate": "2026-04-26",
  "bookingsWithInvoiceCount": 3,
  "totalInvoicedAmount": 7200.00,
  "totalPaidAmount": 3600.00,
  "totalRemainingAmount": 3600.00,
  "totalPendingPayoutAmount": 2880.00,
  "totalScheduledPayoutAmount": 0.00,
  "totalPaidPayoutAmount": 0.00
}
```

---

### GET `/api/internal/reports/finance/summary`
**Access:** Admin (SuperAdmin, Finance)
**Description:** Get aggregated financial totals for a date range.

**Query Parameters:** Same as daily.

**Response `data`:**
```json
{
  "dateFrom": "2026-04-01",
  "dateTo": "2026-04-30",
  "totalBookingsWithInvoiceCount": 38,
  "totalInvoicedAmount": 91200.00,
  "totalPaidAmount": 81600.00,
  "totalRemainingAmount": 9600.00,
  "totalPendingPayoutAmount": 20160.00,
  "totalScheduledPayoutAmount": 0.00,
  "totalPaidPayoutAmount": 45120.00
}
```

---

## Access Matrix Summary

| Endpoint Group | Public | Client | Owner | Sales | Finance | Tech | SuperAdmin |
|---|---|---|---|---|---|---|---|
| Auth | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Projects (read) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Projects (write) | — | — | — | — | — | — | ✓ |
| Amenities (read) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Amenities (write) | — | — | — | — | — | — | ✓ |
| Units (read public) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Units (write) | — | — | — | — | — | ✓ | ✓ |
| Owner Portal | — | — | ✓ | — | — | — | — |
| CRM | — | — | — | ✓ | — | — | ✓ |
| Bookings | — | — | — | ✓ | view | — | ✓ |
| Finance | — | — | — | — | ✓ | — | ✓ |
| Owners (read) | — | — | — | ✓ | ✓ | — | ✓ |
| Owners (write) | — | — | — | — | — | — | ✓ |
| Clients | — | — | — | ✓ | — | — | ✓ |
| Reports | — | — | — | — | ✓ | — | ✓ |
| Admin Users | — | — | — | — | — | — | ✓ |
| Review Moderation | — | — | — | — | — | — | ✓ |
| Review Submission | — | ✓ | — | — | — | — | — |
| Public Reviews | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
