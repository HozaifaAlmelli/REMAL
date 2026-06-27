-- Verification: 0055_date_block_approvals
DO $$
DECLARE
    required_columns text[] := ARRAY[
        'status',
        'requires_admin_signoff',
        'conflicting_lead_id',
        'conflicting_booking_id',
        'resolved_by_admin_user_id',
        'resolved_at',
        'deleted_at'
    ];
    required_column text;
BEGIN
    FOREACH required_column IN ARRAY required_columns LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns AS table_column
            WHERE table_column.table_schema = 'public'
              AND table_column.table_name = 'date_blocks'
              AND table_column.column_name = required_column
        ) THEN
            RAISE EXCEPTION 'Missing date_blocks.% column', required_column;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_date_blocks_status'
    ) THEN
        RAISE EXCEPTION 'Missing ck_date_blocks_status constraint';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname IN (
            'fk_date_blocks_conflicting_lead_id',
            'fk_date_blocks_conflicting_booking_id',
            'fk_date_blocks_resolved_by_admin_user_id'
        )
        GROUP BY conrelid
        HAVING COUNT(*) = 3
    ) THEN
        RAISE EXCEPTION 'One or more date_blocks approval foreign keys are missing';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM date_blocks
        WHERE status <> 'approved'
          AND created_at < (
              SELECT COALESCE(MIN(created_at), CURRENT_TIMESTAMP)
              FROM rbac_role_template_permissions
              WHERE permission_key = 'availability:approve'
          )
    ) THEN
        RAISE EXCEPTION 'At least one pre-existing date block did not default to approved';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM rbac_role_template_permissions
        WHERE role_template_id = '10000000-0000-0000-0000-000000000001'
          AND permission_key = 'availability:approve'
    ) THEN
        RAISE EXCEPTION 'SuperAdmin template is missing availability:approve';
    END IF;
END $$;

SELECT
    COUNT(*) AS date_block_count,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'pending_approval') AS pending_approval_count,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count
FROM date_blocks;
