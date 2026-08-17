-- Guarded rollback. Refuses to discard correction or idempotency audit truth.
BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM historical_owner_attribution_corrections)
       OR EXISTS (SELECT 1 FROM historical_owner_correction_idempotency_keys) THEN
        RAISE EXCEPTION
            '0062 rollback refused: owner-correction or idempotency audit exists; retain schema and use a forward repair';
    END IF;
END $$;

DELETE FROM rbac_role_template_permissions
WHERE permission_key = 'bookings:correct_owner_attribution';

UPDATE admin_users
SET updated_at = CURRENT_TIMESTAMP
WHERE role_template_id = '10000000-0000-0000-0000-000000000001';

DROP TABLE historical_owner_correction_idempotency_keys;
DROP TRIGGER trg_historical_owner_corrections_immutable_truncate
    ON historical_owner_attribution_corrections;
DROP TRIGGER trg_historical_owner_corrections_immutable
    ON historical_owner_attribution_corrections;
DROP FUNCTION reject_historical_owner_correction_mutation();
DROP TABLE historical_owner_attribution_corrections;

DO $$
BEGIN
    IF to_regclass('public.schema_migrations') IS NOT NULL THEN
        EXECUTE 'DELETE FROM schema_migrations WHERE migration_number = $1' USING '0062';
    END IF;
END $$;

COMMIT;
