-- ============================================================================
-- Migration: 0055_date_block_approvals
-- Purpose:   Add owner date-block approval workflow state and permission.
-- Scope:     LOCAL DEV ONLY. Additive.
-- ============================================================================

BEGIN;

ALTER TABLE date_blocks
    ADD COLUMN status                    VARCHAR(20) NOT NULL DEFAULT 'approved',
    ADD COLUMN requires_admin_signoff    BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN conflicting_lead_id       UUID        NULL,
    ADD COLUMN conflicting_booking_id    UUID        NULL,
    ADD COLUMN resolved_by_admin_user_id UUID        NULL,
    ADD COLUMN resolved_at               TIMESTAMP   NULL,
    ADD COLUMN deleted_at                TIMESTAMP   NULL;

ALTER TABLE date_blocks
    ADD CONSTRAINT ck_date_blocks_status
        CHECK (status IN ('approved', 'pending_approval', 'rejected')),
    ADD CONSTRAINT fk_date_blocks_conflicting_lead_id
        FOREIGN KEY (conflicting_lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_date_blocks_conflicting_booking_id
        FOREIGN KEY (conflicting_booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_date_blocks_resolved_by_admin_user_id
        FOREIGN KEY (resolved_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE INDEX ix_date_blocks_status_pending
    ON date_blocks(status)
    WHERE deleted_at IS NULL;

INSERT INTO rbac_role_template_permissions (role_template_id, permission_key, created_at)
VALUES ('10000000-0000-0000-0000-000000000001', 'availability:approve', CURRENT_TIMESTAMP)
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

UPDATE admin_users
SET updated_at = CURRENT_TIMESTAMP
WHERE role_template_id = '10000000-0000-0000-0000-000000000001';

COMMIT;
