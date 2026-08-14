-- Migration: 0064_add_rentable_capacity_history
-- AN-OPS-01B1 versioned resolved rentability intervals.
-- Installing the schema does not publish a coverage epoch or backfill history.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE rentable_capacity_ledger (
    id                         UUID PRIMARY KEY,
    scope                      VARCHAR(20) NOT NULL,
    publication_status         VARCHAR(20) NOT NULL,
    coverage_start_date        DATE NULL,
    published_at               TIMESTAMP NULL,
    published_by_admin_user_id UUID NULL,
    created_at                 TIMESTAMP NOT NULL,
    updated_at                 TIMESTAMP NOT NULL,

    CONSTRAINT uq_rentable_capacity_ledger_scope UNIQUE (scope),
    CONSTRAINT ck_rentable_capacity_ledger_scope CHECK (scope = 'global'),
    CONSTRAINT ck_rentable_capacity_ledger_publication_status
        CHECK (publication_status IN ('uninitialized', 'published')),
    CONSTRAINT ck_rentable_capacity_ledger_publication_coherence CHECK (
        (publication_status = 'uninitialized'
            AND coverage_start_date IS NULL
            AND published_at IS NULL)
        OR
        (publication_status = 'published'
            AND coverage_start_date IS NOT NULL
            AND published_at IS NOT NULL)
    )
);

INSERT INTO rentable_capacity_ledger (
    id,
    scope,
    publication_status,
    coverage_start_date,
    published_at,
    published_by_admin_user_id,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000006401',
    'global',
    'uninitialized',
    NULL,
    NULL,
    NULL,
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
    CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
);

CREATE TABLE unit_rentability_periods (
    id                          UUID PRIMARY KEY,
    unit_id                     UUID NOT NULL,
    effective_from_date         DATE NOT NULL,
    effective_to_date           DATE NULL,
    is_rentable                 BOOLEAN NOT NULL,
    resolved_reason             VARCHAR(40) NOT NULL,
    revision_id                 UUID NOT NULL,
    change_source_type          VARCHAR(50) NOT NULL,
    change_source_id            UUID NULL,
    actor_type                  VARCHAR(30) NULL,
    actor_id                    UUID NULL,
    recorded_at                 TIMESTAMP NOT NULL,
    superseded_at               TIMESTAMP NULL,
    superseded_by_revision_id   UUID NULL,

    CONSTRAINT fk_unit_rentability_periods_unit_id
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT,
    CONSTRAINT ck_unit_rentability_periods_bounds
        CHECK (effective_to_date IS NULL OR effective_to_date > effective_from_date),
    CONSTRAINT ck_unit_rentability_periods_reason
        CHECK (resolved_reason IN ('rentable', 'unit_inactive', 'unit_deleted', 'date_block')),
    CONSTRAINT ck_unit_rentability_periods_source
        CHECK (change_source_type IN (
            'opening_seed',
            'unit_create',
            'unit_update',
            'unit_status',
            'unit_delete',
            'date_block_create',
            'date_block_update',
            'date_block_delete',
            'date_block_request',
            'date_block_resolve',
            'date_block_withdraw'
        )),
    CONSTRAINT ck_unit_rentability_periods_actor
        CHECK ((actor_type IS NULL) = (actor_id IS NULL)),
    CONSTRAINT ck_unit_rentability_periods_supersession
        CHECK ((superseded_at IS NULL) = (superseded_by_revision_id IS NULL))
);

ALTER TABLE unit_rentability_periods
    ADD CONSTRAINT ex_unit_rentability_periods_current_overlap
    EXCLUDE USING gist (
        unit_id WITH =,
        daterange(effective_from_date, effective_to_date, '[)') WITH &&
    ) WHERE (superseded_at IS NULL);

CREATE UNIQUE INDEX uq_unit_rentability_periods_current_open
    ON unit_rentability_periods (unit_id)
    WHERE superseded_at IS NULL AND effective_to_date IS NULL;

CREATE INDEX ix_unit_rentability_periods_current_range
    ON unit_rentability_periods (unit_id, effective_from_date, effective_to_date)
    WHERE superseded_at IS NULL;

CREATE INDEX ix_unit_rentability_periods_revision
    ON unit_rentability_periods (unit_id, revision_id);

COMMENT ON TABLE rentable_capacity_ledger IS
    'AN-OPS-01B1 global publication metadata. Uninitialized means no historical capacity coverage is claimed.';
COMMENT ON TABLE unit_rentability_periods IS
    'AN-OPS-01B1 versioned resolved per-unit rentability projection using half-open date intervals.';

COMMIT;
