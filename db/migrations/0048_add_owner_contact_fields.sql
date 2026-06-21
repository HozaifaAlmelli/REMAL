-- ============================================================================
-- Migration:   0048_add_owner_contact_fields
-- Ticket:      OWNER-CONTACT-01
-- Title:       Add emergency_phone and detailed_address to owners
-- Database:    PostgreSQL 16
-- Depends on:  0006_create_owners (owners table)
-- Created:     2026-06-20
-- ============================================================================
--
-- PURPOSE:
--   Extend the owners table with an emergency contact phone (required going
--   forward) and an optional detailed address. Phone format is enforced at the
--   API layer (^\+?\d{10,15}$) to match the platform's canonical phone rule;
--   no DB CHECK is added so existing rows backfilled with '' remain valid.
--
-- SCHEMA CONTRACT (added columns):
--   emergency_phone   VARCHAR(30)  NOT NULL   — required at API layer
--   detailed_address  TEXT         NULL       — optional free-form address
--
-- CONVENTIONS APPLIED:
--   ✓ snake_case naming
--   ✓ Backfill existing rows via temporary DEFAULT '', then DROP DEFAULT so
--     future inserts must assign explicitly (mirrors 0009 password_hash)
--   ✓ created_at/updated_at untouched (managed by EF Core)
--   ✓ No DB triggers, no seed data
--   ✓ Format validation deferred to API (no CHECK that would reject backfill)
--
-- ============================================================================


-- =====================
-- UP MIGRATION
-- =====================

BEGIN;

-- Required emergency contact. Backfill existing rows with '' to satisfy NOT NULL,
-- then drop the default so future inserts must assign explicitly (EF Core always does).
ALTER TABLE owners ADD COLUMN emergency_phone VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE owners ALTER COLUMN emergency_phone DROP DEFAULT;

-- Optional detailed address (free-form, like notes).
ALTER TABLE owners ADD COLUMN detailed_address TEXT NULL;

COMMENT ON COLUMN owners.emergency_phone IS 'Required emergency contact phone. Format (^\+?\d{10,15}$) enforced at the API layer. Backfilled with '''' for pre-existing rows on migration.';
COMMENT ON COLUMN owners.detailed_address IS 'Optional free-form detailed address for the owner.';

COMMIT;
