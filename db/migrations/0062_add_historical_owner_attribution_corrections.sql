-- Migration: 0062_add_historical_owner_attribution_corrections
-- HB-05 immutable owner-attribution correction chain and dedicated command idempotency.
--
-- Existing historical owner truth is preserved exactly from bookings.owner_id. The
-- preflight refuses incoherent legacy rows and never derives an owner from units,
-- payouts, current commission terms, or any other live relationship.

BEGIN;

DO $$
DECLARE
    violation_count BIGINT;
BEGIN
    SELECT count(*)
    INTO violation_count
    FROM bookings AS booking
    LEFT JOIN owners AS attributed_owner ON attributed_owner.id = booking.owner_id
    LEFT JOIN booking_original_sources AS original_source
        ON original_source.code = booking.original_source
    WHERE booking.is_historical
      AND (
          booking.owner_id IS NULL
          OR attributed_owner.id IS NULL
          OR booking.actual_booked_at IS NULL
          OR booking.historical_entry_reason IS NULL
          OR booking.original_source IS NULL
          OR original_source.code IS NULL
          OR booking.agreed_amount IS NULL
          OR booking.base_amount <> booking.final_amount
          OR booking.agreed_amount <> booking.final_amount
      );

    IF violation_count > 0 THEN
        RAISE EXCEPTION
            'Migration 0062 refused: % historical booking row(s) lack coherent persisted owner, provenance, or financial snapshot truth',
            violation_count;
    END IF;
END $$;

CREATE TABLE historical_owner_attribution_corrections (
    id UUID NOT NULL,
    booking_id UUID NOT NULL,
    previous_owner_id UUID NOT NULL,
    target_owner_id UUID NOT NULL,
    corrected_by_admin_user_id UUID NOT NULL,
    reason VARCHAR(50) NOT NULL,
    note VARCHAR(500) NULL,
    corrected_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT pk_historical_owner_attribution_corrections PRIMARY KEY (id),
    CONSTRAINT fk_historical_owner_corrections_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
    CONSTRAINT fk_historical_owner_corrections_previous_owner
        FOREIGN KEY (previous_owner_id) REFERENCES owners(id) ON DELETE RESTRICT,
    CONSTRAINT fk_historical_owner_corrections_target_owner
        FOREIGN KEY (target_owner_id) REFERENCES owners(id) ON DELETE RESTRICT,
    CONSTRAINT fk_historical_owner_corrections_actor
        FOREIGN KEY (corrected_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
    CONSTRAINT ck_historical_owner_correction_owner_change
        CHECK (previous_owner_id <> target_owner_id),
    CONSTRAINT ck_historical_owner_correction_reason
        CHECK (reason IN (
            'ownership_changed_after_stay',
            'booking_belonged_to_previous_owner_agreement',
            'accounting_reconciliation',
            'other'
        )),
    CONSTRAINT ck_historical_owner_correction_note
        CHECK (
            note IS NULL
            OR (length(btrim(note)) BETWEEN 1 AND 500 AND note = btrim(note))
        ),
    CONSTRAINT ck_historical_owner_correction_other_note
        CHECK (reason <> 'other' OR note IS NOT NULL)
);

CREATE INDEX ix_historical_owner_corrections_booking_chain
    ON historical_owner_attribution_corrections(booking_id, corrected_at, id);
CREATE INDEX ix_historical_owner_corrections_previous_owner_id
    ON historical_owner_attribution_corrections(previous_owner_id);
CREATE INDEX ix_historical_owner_corrections_target_owner_id
    ON historical_owner_attribution_corrections(target_owner_id);
CREATE INDEX ix_historical_owner_corrections_actor_id
    ON historical_owner_attribution_corrections(corrected_by_admin_user_id);

CREATE FUNCTION reject_historical_owner_correction_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'ck_historical_owner_corrections_immutable',
        MESSAGE = 'Historical owner-attribution correction audit is immutable';
END;
$$;

CREATE TRIGGER trg_historical_owner_corrections_immutable
BEFORE UPDATE OR DELETE ON historical_owner_attribution_corrections
FOR EACH ROW EXECUTE FUNCTION reject_historical_owner_correction_mutation();

CREATE TABLE historical_owner_correction_idempotency_keys (
    actor_admin_user_id UUID NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    key UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    correction_id UUID NULL,
    response_status INT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_historical_owner_correction_idempotency_keys
        PRIMARY KEY (actor_admin_user_id, endpoint, key),
    CONSTRAINT fk_historical_owner_correction_idempotency_actor
        FOREIGN KEY (actor_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_historical_owner_correction_idempotency_correction
        FOREIGN KEY (correction_id)
        REFERENCES historical_owner_attribution_corrections(id) ON DELETE RESTRICT,
    CONSTRAINT ck_historical_owner_correction_idempotency_hash
        CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_historical_owner_correction_idempotency_completion
        CHECK (
            (correction_id IS NULL AND response_status IS NULL AND completed_at IS NULL)
            OR
            (correction_id IS NOT NULL AND response_status = 200 AND completed_at IS NOT NULL)
        )
);

CREATE UNIQUE INDEX ux_historical_owner_correction_idempotency_correction_id
    ON historical_owner_correction_idempotency_keys(correction_id)
    WHERE correction_id IS NOT NULL;

-- PermissionCatalog is the repository's permission registry. RBAC tables contain
-- assignments only; owner-approved HB-05 policy intentionally grants this new
-- permission to no broad role template automatically.

COMMIT;
