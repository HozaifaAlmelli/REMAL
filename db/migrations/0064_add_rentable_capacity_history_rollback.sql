-- Rollback: 0064_add_rentable_capacity_history
-- Refuses to discard published or seeded capacity history.
-- btree_gist is retained because extensions may be shared by later objects.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM rentable_capacity_ledger
        WHERE publication_status <> 'uninitialized'
           OR coverage_start_date IS NOT NULL
           OR published_at IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM unit_rentability_periods) THEN
        RAISE EXCEPTION
            '0064 rollback refused: rentable-capacity history has been seeded or published';
    END IF;
END $$;

DROP TABLE unit_rentability_periods;
DROP TABLE rentable_capacity_ledger;

COMMIT;
