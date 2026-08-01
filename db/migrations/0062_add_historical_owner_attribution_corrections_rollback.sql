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

DROP TABLE historical_owner_correction_idempotency_keys;
DROP TRIGGER trg_historical_owner_corrections_immutable
    ON historical_owner_attribution_corrections;
DROP FUNCTION reject_historical_owner_correction_mutation();
DROP TABLE historical_owner_attribution_corrections;

COMMIT;
