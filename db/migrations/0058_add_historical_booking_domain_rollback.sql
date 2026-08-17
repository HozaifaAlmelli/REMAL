-- Safe only before 0059 is rolled back and before any historical or idempotency data exists.
DO $$
BEGIN
    IF to_regclass('public.ux_bookings_external_reference') IS NOT NULL THEN
        RAISE EXCEPTION 'Run 0059_add_historical_booking_external_reference_index_rollback.sql first';
    END IF;

    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE is_historical OR actual_booked_at IS NOT NULL
           OR historical_entry_reason IS NOT NULL OR original_source IS NOT NULL
           OR external_reference IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Unsafe rollback refused: historical booking provenance exists';
    END IF;

    IF EXISTS (SELECT 1 FROM idempotency_keys) THEN
        RAISE EXCEPTION 'Unsafe rollback refused: idempotency records exist';
    END IF;
END $$;

BEGIN;

DELETE FROM rbac_role_template_permissions
WHERE permission_key = 'bookings:record_historical';

UPDATE admin_users
SET updated_at = CURRENT_TIMESTAMP
WHERE role_template_id = '10000000-0000-0000-0000-000000000001';

DROP TABLE idempotency_keys;
DROP INDEX ix_bookings_is_historical;

ALTER TABLE bookings
    DROP CONSTRAINT fk_bookings_original_source,
    DROP CONSTRAINT ck_bookings_historical_fields_coherent,
    DROP CONSTRAINT ck_bookings_historical_entry_reason,
    DROP CONSTRAINT ck_bookings_actual_booked_at_requires_historical,
    DROP COLUMN external_reference,
    DROP COLUMN original_source,
    DROP COLUMN historical_entry_reason,
    DROP COLUMN actual_booked_at,
    DROP COLUMN is_historical;

DROP TABLE booking_original_sources;

COMMIT;
