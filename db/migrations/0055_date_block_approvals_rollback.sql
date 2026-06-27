-- Rollback: 0055_date_block_approvals
BEGIN;

DELETE FROM rbac_role_template_permissions
WHERE permission_key = 'availability:approve';

UPDATE admin_users
SET updated_at = CURRENT_TIMESTAMP
WHERE role_template_id = '10000000-0000-0000-0000-000000000001';

DROP INDEX IF EXISTS ix_date_blocks_status_pending;

ALTER TABLE date_blocks
    DROP CONSTRAINT IF EXISTS fk_date_blocks_resolved_by_admin_user_id,
    DROP CONSTRAINT IF EXISTS fk_date_blocks_conflicting_booking_id,
    DROP CONSTRAINT IF EXISTS fk_date_blocks_conflicting_lead_id,
    DROP CONSTRAINT IF EXISTS ck_date_blocks_status;

ALTER TABLE date_blocks
    DROP COLUMN IF EXISTS deleted_at,
    DROP COLUMN IF EXISTS resolved_at,
    DROP COLUMN IF EXISTS resolved_by_admin_user_id,
    DROP COLUMN IF EXISTS conflicting_booking_id,
    DROP COLUMN IF EXISTS conflicting_lead_id,
    DROP COLUMN IF EXISTS requires_admin_signoff,
    DROP COLUMN IF EXISTS status;

COMMIT;
