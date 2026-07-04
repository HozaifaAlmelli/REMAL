-- ============================================================================
-- Migration: 0057_add_owner_contact_fields
-- Purpose:   Add owner contact fields required by the production Owner entity.
-- ============================================================================

BEGIN;

ALTER TABLE owners
    ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(30) NOT NULL DEFAULT '';

ALTER TABLE owners
    ALTER COLUMN emergency_phone DROP DEFAULT;

ALTER TABLE owners
    ADD COLUMN IF NOT EXISTS detailed_address TEXT NULL;

COMMENT ON COLUMN owners.emergency_phone IS
    'Required emergency contact phone. Format is enforced at the API layer.';

COMMENT ON COLUMN owners.detailed_address IS
    'Optional free-form detailed address for the owner.';

COMMIT;
