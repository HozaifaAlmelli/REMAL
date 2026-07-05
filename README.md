# Rental Platform — Comprehensive Development Walkthroughs

This README serves as the master compilation of all architectural phases, database migrations, data access layers, business logic boundaries, and API integrations developed for the Rental Platform. It is divided into two primary domains: **Domain 1 (Master Data & Authentication)** and **Domain 2 (Units & Availability)**.

> ## 🚀 Production & Operations — start here
>
> Kaza Booking runs on a **shared production VPS** (with Novatova). Before touching
> production, read:
>
> - **[Kaza Production Workbook](docs/KAZA_PRODUCTION_WORKBOOK.md)** — the operator guide
> - **[Documentation index](docs/README.md)** — map of all docs (operations, incidents, archive)
> - **[AI Deployment Skills](docs/ai-deployment-skills/README.md)** — deep deployment playbooks (agents start at [`AGENTS.md`](AGENTS.md))

---

## Table of Contents

### Domain 1: Master Data & Authentication
1. [Tier 1: Database Migrations](#domain-1-tier-1-database-migrations)
2. [Tier 2: Data Access (EF Core)](#domain-1-tier-2-data-access-ef-core)
3. [Tier 3: Business Logic](#domain-1-tier-3-business-logic)
4. [Pre-Tier 4: Architecture Decisions](#pre-tier-4-architecture-decisions)
5. [Tier 4: API & JWT Authentication](#domain-1-tier-4-api--jwt-authentication)

### Domain 2: Units & Availability
6. [Tier 1: Database Migrations](#domain-2-tier-1-database-migrations)
7. [Tier 2: Data Access (EF Core)](#domain-2-tier-2-data-access-ef-core)
8. [Tier 3: Business Logic](#domain-2-tier-3-business-logic)
9. [Tier 4: API Layer](#domain-2-tier-4-api-layer)

### Domain 3: Booking & CRM
10. [Pre-Tier: Architecture Decisions](#domain-3-pre-tier-architecture-decisions)
11. [Tier 1: Database Migrations](#domain-3-tier-1-database-migrations)
12. [Tier 2: Data Access (EF Core)](#domain-3-tier-2-data-access-ef-core)
13. [Tier 3: Business Logic](#domain-3-tier-3-business-logic)
14. [Tier 4: API Layer](#domain-3-tier-4-api-layer)

### Domain 4: Finance & Payments
15. [Tier 1: Database Migrations](#domain-4-tier-1-database-migrations)

---

## Domain 1, Tier 1: Database Migrations

### DB-MD-01: Initialize PostgreSQL Base Conventions
Foundational migration to enable `pgcrypto` extension and document all frozen DB conventions for the Rental Platform's master data tier.
- **Primary Keys:** `UUID DEFAULT gen_random_uuid()`
- **Naming:** `snake_case` for tables, columns, constraints
- **Timestamps:** No DB triggers. Managed by application.
- **Money:** `DECIMAL(12,2)`

### DB-MD-02 to DB-MD-06: Core Master Tables
Created the primary master tables enforcing rigorous constraints, unique partial indexes for emails, and strict domain boundaries (no soft delete for admins, explicit soft deletes for clients/owners):
- `amenities` (Unique names)
- `projects` (Unique names, Activation flags)
- `admin_users` (Role check constraints, Case-insensitive unique emails)
- `clients` (Unique phones, Soft delete limits)
- `owners` (Commission rate boundaries 0-100%, Soft limits)

### DB-MD-07 & DB-MD-08: Integrity & Seeding
- Validated primary key normalization (`pk_{table}`).
- Seeded minimal secure dev data natively utilizing BCrypt factor 12 strings, safely allowing idempotency on duplicate executions.

---

## Domain 1, Tier 2: Data Access (EF Core)

### DA-MD-01: AppDbContext Foundation
Configured `AppDbContext` injecting automated Timestamp & Soft-delete interception cleanly inside `SaveChanges()` translating natively toward Database limits.

### DA-MD-02 to DA-MD-06: Entity Configurations
- Bound strict schema settings generating `HasMaxLength`, `IsUnique` definitions.
- Configured Global Query Filters (`.HasQueryFilter(x => x.DeletedAt == null)`) for Client and Owner visibility isolation.
- Decoupled Enums by injecting `.HasConversion<string>()`.

### DA-MD-07 & DA-MD-08: Generic Repositories & UnitOfWork
- Implemented pure `IRepository<T>` abstractions handling `Get`, `Add`, `Delete` actions safely.
- Wrapped operations purely inside `UnitOfWork` preventing context leaking avoiding disparate generic context updates effectively limiting execution logic correctly.

---

## Domain 1, Tier 3: Business Logic

### BZ-MD-01: Contracts and Exceptions
Unified exceptions mapping natively to Domain expectations (`BusinessValidationException`, `NotFoundException`, `ConflictException`, `UnauthorizedBusinessException`).

### BZ-MD-02 to BZ-MD-05: Service Implementations
Engineered strictly bounded master logic:
- Blocked spaces and casing duplicates effectively mapping unique boundaries safely.
- Implemented soft-deletion safely via standard visibility toggles.
- Executed BCrypt masking securely over Client and Owner validations shielding hash persistence completely mapping configurations independently.

### BZ-MD-06: AuthService Validation Logic
Processed native credential integrations cleanly returning structured `AuthenticatedSubject` outputs avoiding premature token generation logic explicitly.

---

## Pre-Tier 4: Architecture Decisions

Established key governance checks prior to opening external network ports:
- **API Response Boundary:** Banned raw Database Entities leaving controllers, restricted `PasswordHash` definitively, structured `DTO` mappings.
- **Project Lifecycle:** Swapped soft-deletions conceptually out for standard `.IsActive` activation toggles preventing missing constraint chains definitively.
- **UnitOfWork Interfaces:** Bound abstraction boundaries solidly eliminating raw EF structures bleeding into domain logics.
- **Index Ownership:** Officially delegated heavy uniqueness checks to DB SQL scripts avoiding soft EF Core emulation risks purely.

---

## Domain 1, Tier 4: API & JWT Authentication

### API Foundation
Created standardized `ApiResponse<T>` envelopes wrapping structures cleanly across validation boundaries automating error catching efficiently inside `ExceptionHandlingMiddleware`. 

### Auth & Token Management
Generated generic `JwtTokenService` generating HS256 JWTs alongside strictly locked (`HttpOnly`, `SameSite=Strict`) refresh variables securing browser execution streams cleanly across Endpoints (`/api/auth/`).

### Resource Controllers
Constructed endpoint clusters enforcing `[Authorize]` mappings securely shielding resources properly allowing strictly constrained RBAC rules (Roles: `Sales`, `Finance`, `SuperAdmin`).

---

## Domain 2, Tier 1: Database Migrations

### DB-UA-01 & DB-UA-02: Units & Unit Images
Created the inventory anchor `units` applying foreign constraints scaling properly mapping relationships to owners and projects structurally. Ensured relational media blocks dynamically matching cascades across `unit_images`.

### DB-UA-03: Unit Amenities
Applied strict many-to-many composites avoiding surrogate identity wrappers securing database unique linkings natively via composite primary key constraints.

### DB-UA-04 & DB-UA-05: Operational Seasonal Configurations
Secured explicitly mapped pricing arrays bounding ranges logically. Maintained structural configurations across `seasonal_pricing` and `date_blocks` explicitly deferring complex chronological overlap validations intentionally to the Business Logic algorithms avoiding trigger bloat inside the database tier.

---

## Domain 2, Tier 2: Data Access (EF Core)

Extended `AppDbContext` allocating `DbSets` wrapping constraints matching Schema arrays identically:
- Restricted `UnitType` and monetary limits utilizing `.HasColumnType("decimal(12,2)")`.
- Established `DeleteBehavior.Cascade` matching relationships mapped by tier exactly preventing orphan states.
- Bound composite endpoints cleanly over `UnitAmenities` mapping EF safely.

---

## Domain 2, Tier 3: Business Logic

### Unit, Media, & Links 
Engineered exact data operations providing relational checking efficiently throwing `NotFoundException`s against blind IDs natively tracking states safely tracking single-cover implementations eliminating CDN configurations actively.
- Native `ReplaceAllAsync` algorithms check delta arrays seamlessly intersecting `UnitAmenities` independently natively.

### Deterministic Overlap Preventions
Bounded configurations verifying overlapping limits natively across:
- **`SeasonalPricingService`**
- **`DateBlockService`**
Blocking identically checking explicit combinations natively generating bounds safely preventing chronological collisions exactly (`startDate <= DB.EndDate && endDate >= DB.StartDate`).

### Agnostic Availability Queries (`UnitAvailabilityService`)
Calculated operational representations filtering `DateBlock`s computing structural constraints resolving nightly sequences seamlessly bypassing booking metrics extracting arrays formatted accurately into Base vs Seasonal structures calculating exact total representations dynamically natively securely!

---

## Domain 2, Tier 4: API Layer

### API-UA-01: DTO Contracts & Validators
Constructed explicitly mapped Request and Response shapes (e.g., `UnitListItemResponse`, `UnitPricingResponse`) to maintain an absolute barrier against EF Core entities bleeding into HTTP outputs. Implemented rigorous `FluentValidation` patterns enforcing string safety, positive numbers, and correct data combinations across the domain.

### API-UA-02: UnitsController
Formed distinct operational read paths partitioning unauthenticated Public queries (filtering down exclusively to active units) apart from authentic `Sales` analytics and `SuperAdmin` structural mapping functions (`POST`, `PATCH /status`), natively preventing unauthorized mutations.

### API-UA-03: UnitImagesController
Safely isolated ordinal display tracking and metadata tagging (like `isCover`) avoiding complex raw binary upload logic bleeding into the metadata pipeline loops. Provided safe 404 blockades preventing offline-unit access visually.

### API-UA-04: UnitAmenitiesController
Simplified relation assignments (`AssignAsync`, `ReplaceAllAsync`) mapping directly between explicit ID vectors ensuring clean assignment without convoluting the pipeline natively using broader index or categorical searches prematurely. 

### API-UA-05: Scheduling (SeasonalPricingController & DateBlocksController)
Executed strict `SuperAdminOnly` structural modifiers projecting accurate chronologies without allowing scheduling payloads to falsely trigger real Booking logic evaluations prematurely. Heavily relies natively upon Tier 3 business validation intercepts to resolve overlapping issues intuitively.

### API-UA-06: UnitAvailabilityController
Explicitly configured public-facing operational endpoints `operational-check` and `pricing/calculate` retrieving dynamic arrays mapping operational limits accurately securely avoiding semantic "booking confirmation" promises perfectly closing the layer!

---

## Domain 3, Pre-Tier: Architecture Decisions

### PRE-BOOK-01: Booking Date Semantics
Explicitly segregated the semantic difference between operational "pricing blocks" and standard hotel check-in/check-outs, establishing the absolute boundary rules converting check-in/checkout periods safely preventing trailing day bugs.

---

## Domain 3, Tier 1: Database Migrations

### DB-BC-01: Core Bookings Table
Constructed the `bookings` baseline with rigorous checking protecting the state array (`inquiry`, `pending`, `confirmed`, `cancelled`, `completed`). Frozen strict stay arrays avoiding `deleted_at` soft deletions over the core record natively.

### DB-BC-02: Booking Status History
Implemented specific targeted audit transitions (`booking_status_history`) isolating historical event streams explicitly avoiding polymorphic attachment bloat schemas perfectly.

### DB-BC-03: CRM Leads
Mapped standalone pre-booking funnels securely inside `crm_leads`. Enforced strict temporal stay ranges permitting partially null boundaries perfectly fitting the pre-conversion funnel realities.

### DB-BC-04: CRM Notes
Generated exact one-to-one constraint structures safely anchoring text followups exactly to a single Lead or a Booking using `ck_crm_notes_exactly_one_parent`. 

### DB-BC-05: CRM Assignments
Isolated workload tracking to active tracking via `crm_assignments`, rejecting workflow-bloat fields safely.

### DB-BC-06: Integrity Checkgate
Swept constraints globally locking the Data Access definitions securely into exact `0021_booking_crm_integrity_cleanup_verify` specifications proving explicitly that no fields breached the isolated boundaries natively.

---

## Domain 3, Tier 2: Data Access (EF Core)

### DA-BC-01: AppDbContext Extension
Successfully extended `AppDbContext` to include the Booking & CRM domain entities. Integrated `Bookings`, `BookingStatusHistories`, `CrmLeads`, `CrmNotes`, and `CrmAssignments` while ensuring that the global soft-delete filter does not leak into this domain, preserving the physical deletion contract.

### DA-BC-02 to DA-BC-05: Domain Entity Configurations
- **Booking & Audit:** Implemented `Booking` and `BookingStatusHistory` with strict `decimal(12,2)` precision for money and `DateOnly` for stay period semantics.
- **CRM Pipeline:** Created `CrmLead` as a standalone inquiry record, independent of booking state to maintain funnel integrity.
- **Exactly-One-Parent Logic:** Configured `CrmNote` and `CrmAssignment` to support exclusive parent relationships (either a Booking or a Lead) through nullable EF Core mappings and DB check constraints, avoiding polymorphic engine bloat.

### DA-BC-06: UnitOfWork Expansion
Exposed the new domain through the project's official `IUnitOfWork` repository facade. This ensures that the upcoming Business tier can interact with the Booking & CRM data safely and consistently without direct `DbContext` dependencies.

---

## Domain 3, Tier 3: Business Logic

### BZ-BC-01: Contracts & Domain Decision Note
Defined five service interfaces (`IBookingService`, `IBookingLifecycleService`, `ICrmLeadService`, `ICrmNoteService`, `ICrmAssignmentService`) and froze all domain rules in decision note `0007_booking_crm_business_scope.md`. Key frozen decisions: check-in/check-out semantics with `checkOutDate - 1 day` pricing translation, confirmed-only blocking (pending/inquiry do not hard-block), default `pending` status, lead conversion atomicity, and explicit exclusion of payments/reviews/notifications.

### BZ-BC-02: BookingService
Implemented core booking creation and pending-update flows. Validates client/unit/admin existence, guest count against unit capacity, and source whitelist (`direct`, `admin`, `phone`, `whatsapp`, `website`). Computes pricing snapshot at creation time using `IUnitAvailabilityService.CalculatePricingAsync` with the frozen date translation rule. Enforces confirmed-only overlap blocking and creates an initial `BookingStatusHistory` row on every new booking. Owner ID is snapshotted from `unit.OwnerId`, never from caller input.

### BZ-BC-03: BookingLifecycleService
Manages controlled status transitions with an explicit transition matrix: `pending/inquiry → confirmed`, `inquiry/pending/confirmed → cancelled`, `confirmed → completed`. Every valid transition appends one `BookingStatusHistory` row. `ConfirmAsync` re-checks that the unit is still active, operational availability is clear, and no confirmed overlap exists (excluding self). No money mutation, no payment/refund/notification side effects.

### BZ-BC-04: CrmLeadService
Manages CRM leads with contact validation (name, phone required), desired-stay validation (date range, guest count), source/status whitelists, and optional reference checks. `ConvertToBookingAsync` delegates booking creation entirely to `IBookingService.CreateAsync` — lead becomes `converted` only on successful booking creation. Enforces client/unit mismatch detection against pre-linked lead data and blocks conversion of already-converted or lost leads. Lead remains a distinct entity with no `booking_id` field.

### BZ-BC-05: CrmNoteService
Provides exactly-one-parent note management (booking XOR lead). Each `Add` method explicitly sets the other parent to `null`. Parent existence validated on all get/add operations. Note text required after trimming. Physical delete in current MVP. No attachments, version history, or generic parent abstraction.

### BZ-BC-06: CrmAssignmentService
Enforces one-active-assignment semantics per parent entity. Reassignment deactivates all previous active rows before creating a new one. Idempotent guard returns existing assignment when assigning the same admin. Parent snapshot fields (`booking.AssignedAdminUserId` / `lead.AssignedAdminUserId`) are always synchronized in lockstep with assignment rows. Clear operations deactivate rows and set snapshot to `null`. No queue, SLA, escalation, or notification logic.

---

## Domain 3, Tier 4: API Layer

### API-BC-01: DTO Contracts & Validators
Implemented 21+ explicit DTOs (e.g., BookingDetailsResponse, PublicCreateCrmLeadRequest) and rigorous FluentValidation rules, ensuring no entities leak into the network.

### API-BC-02: BookingsController (Internal Management)
Established internal operational surface for booking management, providing paginated lists, detailed reads, status history auditing, and limited updates for pending records.

### API-BC-03: BookingLifecycleController (Atomic Transitions)
Isolated high-impact status changes (confirm, cancel, complete) from CRUD. Automatically extracts Admin identity from JWT claims for secure auditing.

### API-BC-04: CrmLeadsController (Public & Internal)
Bridged website lead capture with the internal sales pipeline. Supports anonymous public capture and authorized lead-to-booking conversion flows.

### API-BC-05 & API-BC-06: CRM Support (Notes & Assignments)
Centralized operational follow-ups and workload ownership management. Strictly enforces exactly-one-parent and one-active-assignment semantics across the domain.

---

## Domain 4, Tier 1: Database Migrations

### DB-PF-01: Payments Core
Established the core `payments` table linked to bookings, enforcing strict status and method whitelists alongside positive amount verification.

### DB-PF-02 & DB-PF-03: Invoices & Breakdown
Implemented `invoices` and `invoice_items` as the standalone billing authority. Enforced atomic line-item math (`line_total = quantity * unit_amount`) and total/subtotal equality for the MVP baseline. Established cascade deletion paths to prevent orphaned items.

### DB-PF-04: Owner Payout Basis
Constructed the mechanism to track owner earnings and platform commissions per booking. Implemented mathematical formula checks (`payout = gross - commission`) and range boundaries for commission snapshots.

### DB-PF-05: Finance Integrity Checkgate
Successfully executed a final domain sweep, verifying universal `DECIMAL(12,2)` usage, correct constraint naming, and the absolute removal of out-of-scope fields (tax engines, external gateway payloads, refunds) to protect the MVP scope.

