-- Verifier: 0064_add_rentable_capacity_history
-- Verifies schema integrity only. Publication is a separate explicit operation.

DO $$
DECLARE
    ledger_count INTEGER;
    period_count INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
        RAISE EXCEPTION '0064 verifier: btree_gist is not installed';
    END IF;

    IF to_regclass('rentable_capacity_ledger') IS NULL OR
       to_regclass('unit_rentability_periods') IS NULL THEN
        RAISE EXCEPTION '0064 verifier: one or more ledger tables are missing';
    END IF;

    SELECT COUNT(*) INTO ledger_count FROM rentable_capacity_ledger;
    IF ledger_count <> 1 THEN
        RAISE EXCEPTION '0064 verifier: expected exactly one global ledger row, found %', ledger_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM rentable_capacity_ledger
        WHERE scope = 'global'
          AND publication_status = 'uninitialized'
          AND coverage_start_date IS NULL
          AND published_at IS NULL
    ) THEN
        RAISE EXCEPTION '0064 verifier: migration must leave the ledger explicitly unpublished';
    END IF;

    SELECT COUNT(*) INTO period_count FROM unit_rentability_periods;
    IF period_count <> 0 THEN
        RAISE EXCEPTION '0064 verifier: migration must not backfill rentability history';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ex_unit_rentability_periods_current_overlap'
          AND contype = 'x'
    ) THEN
        RAISE EXCEPTION '0064 verifier: current-period exclusion constraint is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'uq_unit_rentability_periods_current_open'
    ) THEN
        RAISE EXCEPTION '0064 verifier: current open-period uniqueness is missing';
    END IF;
END $$;
