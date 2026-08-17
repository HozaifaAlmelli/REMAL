-- Guarded rollback. Refuses to discard historical evidence or idempotency audit.
BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM payments WHERE is_historical_record)
       OR EXISTS (SELECT 1 FROM historical_payment_idempotency_keys) THEN
        RAISE EXCEPTION
            '0061 rollback refused: historical payment evidence or idempotency audit exists; retain schema and use a forward repair';
    END IF;
END $$;

DELETE FROM rbac_role_template_permissions
WHERE permission_key = 'payments:record_historical';

DROP TABLE historical_payment_idempotency_keys;
DROP INDEX ux_payments_historical_reference;
DROP INDEX ix_payments_created_by_admin_user_id;
ALTER TABLE payments
    DROP CONSTRAINT ck_payments_historical_record_coherent,
    DROP CONSTRAINT fk_payments_created_by_admin_user_id,
    DROP COLUMN recorded_reason,
    DROP COLUMN created_by_admin_user_id,
    DROP COLUMN is_historical_record;

COMMIT;
