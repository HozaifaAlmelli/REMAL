-- Rollback: 0063_add_historical_reporting_read_models
-- Restores the exact 0052 definitions and removes only HB-08A2-owned views.

BEGIN;

DROP VIEW IF EXISTS reporting_historical_entry_reconciliation;
DROP VIEW IF EXISTS reporting_finance_stay_daily_summary;
DROP VIEW IF EXISTS reporting_booking_stay_daily_summary;
DROP VIEW reporting_finance_daily_summary;
DROP VIEW reporting_booking_daily_summary;

CREATE VIEW reporting_booking_daily_summary AS
SELECT
    DATE(b.created_at)                                              AS metric_date,
    b.source                                                        AS booking_source,
    COUNT(*)                                                        AS bookings_created_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'prospecting')        AS prospecting_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'confirmed')          AS confirmed_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'cancelled')          AS cancelled_bookings_count,
    COUNT(*) FILTER (WHERE b.booking_status = 'completed')          AS completed_bookings_count,
    COALESCE(SUM(b.final_amount), 0)::DECIMAL(14,2)                 AS total_final_amount
FROM bookings b
GROUP BY
    DATE(b.created_at),
    b.source;

COMMENT ON VIEW reporting_booking_daily_summary IS
    'Reports & Analytics read model: daily booking creation counts and '
    'current-status distribution by booking source. Prospecting replaces the '
    'removed legacy pending booking status. Source: bookings.';

CREATE VIEW reporting_finance_daily_summary AS
WITH daily_invoices AS (
    SELECT
        b.id                                        AS booking_id,
        DATE(b.created_at)                          AS metric_date,
        i.id                                        AS invoice_id,
        COALESCE(i.total_amount, 0)                 AS invoice_total
    FROM bookings b
    LEFT JOIN invoices i
        ON i.booking_id = b.id
       AND i.invoice_status NOT IN ('cancelled', 'superseded')
),
daily_paid AS (
    SELECT
        p.invoice_id                                AS invoice_id,
        COALESCE(SUM(p.amount), 0)                  AS paid_amount
    FROM payments p
    WHERE p.payment_status = 'paid'
      AND p.invoice_id IS NOT NULL
    GROUP BY p.invoice_id
),
daily_payouts AS (
    SELECT
        b.id                                                                AS booking_id,
        DATE(b.created_at)                                                  AS metric_date,
        COALESCE(SUM(op.payout_amount) FILTER (WHERE op.payout_status = 'pending'),   0) AS pending_payout_amount,
        COALESCE(SUM(op.payout_amount) FILTER (WHERE op.payout_status = 'scheduled'), 0) AS scheduled_payout_amount,
        COALESCE(SUM(op.payout_amount) FILTER (WHERE op.payout_status = 'paid'),      0) AS paid_payout_amount
    FROM bookings b
    LEFT JOIN owner_payouts op
        ON op.booking_id = b.id
    GROUP BY b.id, DATE(b.created_at)
)
SELECT
    di.metric_date                                                          AS metric_date,
    COUNT(DISTINCT CASE WHEN di.invoice_id IS NOT NULL
                        THEN di.booking_id END)::INT                        AS bookings_with_invoice_count,
    COALESCE(SUM(di.invoice_total), 0)::DECIMAL(14,2)                       AS total_invoiced_amount,
    COALESCE(SUM(dp.paid_amount), 0)::DECIMAL(14,2)                         AS total_paid_amount,
    (COALESCE(SUM(di.invoice_total), 0)
     - COALESCE(SUM(dp.paid_amount), 0))::DECIMAL(14,2)                     AS total_remaining_amount,
    COALESCE(SUM(dpo.pending_payout_amount), 0)::DECIMAL(14,2)              AS total_pending_payout_amount,
    COALESCE(SUM(dpo.scheduled_payout_amount), 0)::DECIMAL(14,2)            AS total_scheduled_payout_amount,
    COALESCE(SUM(dpo.paid_payout_amount), 0)::DECIMAL(14,2)                 AS total_paid_payout_amount
FROM daily_invoices di
LEFT JOIN daily_paid dp
    ON dp.invoice_id = di.invoice_id
LEFT JOIN daily_payouts dpo
    ON dpo.booking_id = di.booking_id
   AND dpo.metric_date = di.metric_date
GROUP BY
    di.metric_date;

COMMENT ON VIEW reporting_finance_daily_summary IS
    'Reports & Analytics read model: daily finance summary by booking creation date. '
    'Cancelled and superseded invoices and non-paid payments are excluded. '
    'Source: bookings, invoices, payments, owner_payouts.';

DO $$
BEGIN
    IF to_regclass('schema_migrations') IS NOT NULL THEN
        DELETE FROM schema_migrations
        WHERE migration_number = '0063';
    END IF;
END $$;

COMMIT;
