-- Migration: 0061_add_historical_payment_recording
-- HB-04B immutable historical-payment evidence and dedicated command idempotency.
-- Additive and transactional. Existing payments remain nonhistorical; no actor,
-- reason, or historical identity is fabricated for them.

BEGIN;

ALTER TABLE payments
    ADD COLUMN is_historical_record BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN created_by_admin_user_id UUID NULL,
    ADD COLUMN recorded_reason VARCHAR(500) NULL;

ALTER TABLE payments
    ADD CONSTRAINT fk_payments_created_by_admin_user_id
        FOREIGN KEY (created_by_admin_user_id)
        REFERENCES admin_users(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT ck_payments_historical_record_coherent
        CHECK (
            (NOT is_historical_record
                AND recorded_reason IS NULL)
            OR
            (is_historical_record
                AND payment_status = 'paid'
                AND invoice_id IS NULL
                AND paid_at IS NOT NULL
                AND created_by_admin_user_id IS NOT NULL
                AND recorded_reason IS NOT NULL
                AND length(btrim(recorded_reason)) BETWEEN 1 AND 500)
        ) NOT VALID;

ALTER TABLE payments
    VALIDATE CONSTRAINT ck_payments_historical_record_coherent;

CREATE INDEX ix_payments_created_by_admin_user_id
    ON payments(created_by_admin_user_id);

CREATE UNIQUE INDEX ux_payments_historical_reference
    ON payments(booking_id, lower(btrim(reference_number)))
    WHERE is_historical_record AND reference_number IS NOT NULL;

CREATE TABLE historical_payment_idempotency_keys (
    actor_admin_user_id UUID NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    key UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    payment_id UUID NULL,
    response_status INT NULL,
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL,
    CONSTRAINT pk_historical_payment_idempotency_keys
        PRIMARY KEY (actor_admin_user_id, endpoint, key),
    CONSTRAINT fk_historical_payment_idempotency_actor
        FOREIGN KEY (actor_admin_user_id)
        REFERENCES admin_users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_historical_payment_idempotency_payment
        FOREIGN KEY (payment_id)
        REFERENCES payments(id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_historical_payment_idempotency_hash
        CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_historical_payment_idempotency_completion
        CHECK (
            (payment_id IS NULL AND response_status IS NULL AND completed_at IS NULL)
            OR
            (payment_id IS NOT NULL AND response_status = 200 AND completed_at IS NOT NULL)
        )
);

CREATE UNIQUE INDEX ux_historical_payment_idempotency_payment_id
    ON historical_payment_idempotency_keys(payment_id)
    WHERE payment_id IS NOT NULL;

INSERT INTO rbac_role_template_permissions
    (role_template_id, permission_key, created_at)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'payments:record_historical', CURRENT_TIMESTAMP)
ON CONFLICT (role_template_id, permission_key) DO NOTHING;

COMMIT;
