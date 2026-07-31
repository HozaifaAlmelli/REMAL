-- Migration: 0058_add_historical_booking_domain
-- HB-02 transactional domain, provenance, idempotency, and permission objects.

BEGIN;

CREATE TABLE booking_original_sources (
    code       VARCHAR(50)  NOT NULL,
    label      VARCHAR(100) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL,
    updated_at TIMESTAMP    NOT NULL,
    CONSTRAINT pk_booking_original_sources PRIMARY KEY (code)
);

INSERT INTO booking_original_sources
    (code, label, is_active, created_at, updated_at)
VALUES
    ('legacy_system', 'Legacy system', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('external_platform', 'External platform', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('offline_record', 'Offline record', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('other', 'Other', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE bookings
    ADD COLUMN is_historical          BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN actual_booked_at       DATE        NULL,
    ADD COLUMN historical_entry_reason VARCHAR(50) NULL,
    ADD COLUMN original_source        VARCHAR(50) NULL,
    ADD COLUMN external_reference     VARCHAR(100) NULL;

ALTER TABLE bookings
    ADD CONSTRAINT ck_bookings_actual_booked_at_requires_historical
        CHECK (actual_booked_at IS NULL OR is_historical) NOT VALID,
    ADD CONSTRAINT ck_bookings_historical_entry_reason
        CHECK (
            historical_entry_reason IS NULL OR historical_entry_reason IN (
                'offline_booking_recorded_after_stay',
                'external_platform_import',
                'late_operational_entry',
                'accounting_reconciliation',
                'other'
            )
        ) NOT VALID,
    ADD CONSTRAINT ck_bookings_historical_fields_coherent
        CHECK (
            (is_historical
                AND actual_booked_at IS NOT NULL
                AND historical_entry_reason IS NOT NULL
                AND original_source IS NOT NULL)
            OR NOT is_historical
        ) NOT VALID,
    ADD CONSTRAINT fk_bookings_original_source
        FOREIGN KEY (original_source)
        REFERENCES booking_original_sources(code)
        ON DELETE RESTRICT
        NOT VALID;

ALTER TABLE bookings VALIDATE CONSTRAINT ck_bookings_actual_booked_at_requires_historical;
ALTER TABLE bookings VALIDATE CONSTRAINT ck_bookings_historical_entry_reason;
ALTER TABLE bookings VALIDATE CONSTRAINT ck_bookings_historical_fields_coherent;
ALTER TABLE bookings VALIDATE CONSTRAINT fk_bookings_original_source;

CREATE INDEX ix_bookings_is_historical
    ON bookings(is_historical)
    WHERE is_historical;

CREATE TABLE idempotency_keys (
    actor_admin_user_id UUID      NOT NULL,
    endpoint            TEXT      NOT NULL,
    key                 TEXT      NOT NULL,
    request_hash        TEXT      NOT NULL,
    response_status     INT       NULL,
    booking_id          UUID      NULL,
    created_at          TIMESTAMP NOT NULL,
    completed_at        TIMESTAMP NULL,
    CONSTRAINT pk_idempotency_keys
        PRIMARY KEY (actor_admin_user_id, endpoint, key),
    CONSTRAINT fk_idempotency_keys_actor_admin_user_id
        FOREIGN KEY (actor_admin_user_id)
        REFERENCES admin_users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_idempotency_keys_booking_id
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE RESTRICT
);

INSERT INTO rbac_role_template_permissions
    (role_template_id, permission_key, created_at)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'bookings:record_historical', CURRENT_TIMESTAMP)
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

UPDATE admin_users
SET updated_at = CURRENT_TIMESTAMP
WHERE role_template_id = '10000000-0000-0000-0000-000000000001';

COMMIT;
