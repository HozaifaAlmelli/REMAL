-- ============================================================================
-- KAZA — PRODUCTION DB init (first boot only, empty volume).
-- ----------------------------------------------------------------------------
-- Differs from the dev db/init.sql in TWO deliberate ways:
--   1. DEV SEED migrations are EXCLUDED:
--        - 0008_seed_dev_master_data   (fake amenities/projects)
--        - 0047_seed_minimal_dev_login (dev login accounts w/ known passwords)
--        - 0046 is already excluded upstream (heavy demo dataset).
--      => Production starts with a clean schema and NO seeded credentials.
--         Real master data + the first admin are provisioned via a controlled
--         step (see docs/deployment.md), never seeded here.
--   2. A schema_migrations ledger is created and the applied baseline recorded,
--      so scripts/apply-migrations.sh knows where to resume (Blocker B7).
-- This file is NEW infra; the existing db/init.sql is left untouched.
-- ============================================================================

-- ── Migration tracking ledger (Blocker B7) ──
CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,
    migration_number TEXT NOT NULL UNIQUE,
    migration_name TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

\echo '=== [prod] 0001: init postgres conventions ==='
\i /docker-entrypoint-initdb.d/migrations/0001_init_postgres_conventions.sql
\echo '=== [prod] 0002: create amenities ==='
\i /docker-entrypoint-initdb.d/migrations/0002_create_amenities.sql
\echo '=== [prod] 0003: create areas ==='
\i /docker-entrypoint-initdb.d/migrations/0003_create_areas.sql
\echo '=== [prod] 0004: create admin users ==='
\i /docker-entrypoint-initdb.d/migrations/0004_create_admin_users.sql
\echo '=== [prod] 0005: create clients ==='
\i /docker-entrypoint-initdb.d/migrations/0005_create_clients.sql
\echo '=== [prod] 0006: create owners ==='
\i /docker-entrypoint-initdb.d/migrations/0006_create_owners.sql
\echo '=== [prod] 0007: master data integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0007_master_data_integrity_cleanup.sql
-- 0008 (seed dev master data) INTENTIONALLY SKIPPED in production.
\echo '=== [prod] 0009: add owner password hash ==='
\i /docker-entrypoint-initdb.d/migrations/0009_add_owner_password_hash_to_owners.sql
\echo '=== [prod] 0010: create units ==='
\i /docker-entrypoint-initdb.d/migrations/0010_create_units.sql
\echo '=== [prod] 0011: create unit_images ==='
\i /docker-entrypoint-initdb.d/migrations/0011_create_unit_images.sql
\echo '=== [prod] 0012: create unit_amenities ==='
\i /docker-entrypoint-initdb.d/migrations/0012_create_unit_amenities.sql
\echo '=== [prod] 0013: create seasonal_pricing ==='
\i /docker-entrypoint-initdb.d/migrations/0013_create_seasonal_pricing.sql
\echo '=== [prod] 0014: create date_blocks ==='
\i /docker-entrypoint-initdb.d/migrations/0014_create_date_blocks.sql
\echo '=== [prod] 0015: units availability integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0015_units_availability_integrity_cleanup.sql
\echo '=== [prod] 0016: create bookings ==='
\i /docker-entrypoint-initdb.d/migrations/0016_create_bookings.sql
\echo '=== [prod] 0017: create booking status history ==='
\i /docker-entrypoint-initdb.d/migrations/0017_create_booking_status_history.sql
\echo '=== [prod] 0018: create crm leads ==='
\i /docker-entrypoint-initdb.d/migrations/0018_create_crm_leads.sql
\echo '=== [prod] 0019: create crm notes ==='
\i /docker-entrypoint-initdb.d/migrations/0019_create_crm_notes.sql
\echo '=== [prod] 0020: create crm assignments ==='
\i /docker-entrypoint-initdb.d/migrations/0020_create_crm_assignments.sql
\echo '=== [prod] 0021: booking crm integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0021_booking_crm_integrity_cleanup.sql
\echo '=== [prod] 0022: create payments ==='
\i /docker-entrypoint-initdb.d/migrations/0022_create_payments.sql
\echo '=== [prod] 0023: create invoices ==='
\i /docker-entrypoint-initdb.d/migrations/0023_create_invoices.sql
\echo '=== [prod] 0024: create invoice items ==='
\i /docker-entrypoint-initdb.d/migrations/0024_create_invoice_items.sql
\echo '=== [prod] 0025: create owner payouts ==='
\i /docker-entrypoint-initdb.d/migrations/0025_create_owner_payouts.sql
\echo '=== [prod] 0026: payments finance integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0026_payments_finance_integrity_cleanup.sql
\echo '=== [prod] 0027: owner portal units overview view ==='
\i /docker-entrypoint-initdb.d/migrations/0027_create_owner_portal_units_overview_view.sql
\echo '=== [prod] 0028: owner portal bookings overview view ==='
\i /docker-entrypoint-initdb.d/migrations/0028_create_owner_portal_bookings_overview_view.sql
\echo '=== [prod] 0029: owner portal finance overview view ==='
\i /docker-entrypoint-initdb.d/migrations/0029_create_owner_portal_finance_overview_view.sql
\echo '=== [prod] 0030: owner portal integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0030_owner_portal_integrity_cleanup.sql
\echo '=== [prod] 0031: create reviews ==='
\i /docker-entrypoint-initdb.d/migrations/0031_create_reviews.sql
\echo '=== [prod] 0032: create review status history ==='
\i /docker-entrypoint-initdb.d/migrations/0032_create_review_status_history.sql
\echo '=== [prod] 0033: create unit review summaries ==='
\i /docker-entrypoint-initdb.d/migrations/0033_create_unit_review_summaries.sql
\echo '=== [prod] 0034: create review replies ==='
\i /docker-entrypoint-initdb.d/migrations/0034_create_review_replies.sql
\echo '=== [prod] 0035: reviews ratings integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0035_reviews_ratings_integrity_cleanup.sql
\echo '=== [prod] 0036: create notification templates ==='
\i /docker-entrypoint-initdb.d/migrations/0036_create_notification_templates.sql
\echo '=== [prod] 0037: create notifications ==='
\i /docker-entrypoint-initdb.d/migrations/0037_create_notifications.sql
\echo '=== [prod] 0038: create notification delivery logs ==='
\i /docker-entrypoint-initdb.d/migrations/0038_create_notification_delivery_logs.sql
\echo '=== [prod] 0039: create notification preferences ==='
\i /docker-entrypoint-initdb.d/migrations/0039_create_notification_preferences.sql
\echo '=== [prod] 0040: notifications alerts integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0040_notifications_alerts_integrity_cleanup.sql
\echo '=== [prod] 0041: reporting booking daily summary view ==='
\i /docker-entrypoint-initdb.d/migrations/0041_create_reporting_booking_daily_summary_view.sql
\echo '=== [prod] 0042: reporting finance daily summary view ==='
\i /docker-entrypoint-initdb.d/migrations/0042_create_reporting_finance_daily_summary_view.sql
\echo '=== [prod] 0043: reporting reviews daily summary view ==='
\i /docker-entrypoint-initdb.d/migrations/0043_create_reporting_reviews_daily_summary_view.sql
\echo '=== [prod] 0044: reporting notifications daily summary view ==='
\i /docker-entrypoint-initdb.d/migrations/0044_create_reporting_notifications_daily_summary_view.sql
\echo '=== [prod] 0045: reports analytics integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0045_reports_analytics_integrity_cleanup.sql
-- 0046 (heavy demo dataset) and 0047 (dev login seed) INTENTIONALLY SKIPPED in production.
\echo '=== [prod] 0048: align CRM lead pipeline ==='
\i /docker-entrypoint-initdb.d/migrations/0048_align_crm_lead_pipeline.sql
\echo '=== [prod] 0049: owner portal finance display names ==='
\i /docker-entrypoint-initdb.d/migrations/0049_owner_portal_finance_names.sql
\echo '=== [prod] 0050: add is_active flag to amenities ==='
\i /docker-entrypoint-initdb.d/migrations/0050_add_amenity_is_active.sql
\echo '=== [prod] 0051: allow superseded invoice status ==='
\i /docker-entrypoint-initdb.d/migrations/0051_allow_superseded_invoice_status.sql
\echo '=== [prod] 0052: align reporting views with current pipelines ==='
\i /docker-entrypoint-initdb.d/migrations/0052_align_reporting_views_with_pipeline.sql
\echo '=== [prod] 0053: create dynamic RBAC ==='
\i /docker-entrypoint-initdb.d/migrations/0053_create_dynamic_rbac.sql
\echo '=== [prod] 0054: rename areas domain to projects ==='
\i /docker-entrypoint-initdb.d/migrations/0054_rename_areas_to_projects.sql
\echo '=== [prod] 0055: date block approvals ==='
\i /docker-entrypoint-initdb.d/migrations/0055_date_block_approvals.sql
\echo '=== [prod] 0056: add unit portfolio visibility ==='
\i /docker-entrypoint-initdb.d/migrations/0056_add_unit_portfolio_visibility.sql
\echo '=== [prod] 0057: add owner contact fields ==='
\i /docker-entrypoint-initdb.d/migrations/0057_add_owner_contact_fields.sql

-- ── Record the applied baseline (everything run above) ──
-- scripts/apply-migrations.sh resumes from the highest recorded number.
INSERT INTO schema_migrations (migration_number, migration_name)
SELECT n, 'baseline (init.prod.sql)'
FROM unnest(ARRAY[
  '0001','0002','0003','0004','0005','0006','0007','0009','0010',
  '0011','0012','0013','0014','0015','0016','0017','0018','0019','0020',
  '0021','0022','0023','0024','0025','0026','0027','0028','0029','0030',
  '0031','0032','0033','0034','0035','0036','0037','0038','0039','0040',
  '0041','0042','0043','0044','0045','0048','0049','0050','0051','0052',
  '0053','0054','0055','0056','0057'
]) AS n
ON CONFLICT (migration_number) DO NOTHING;

\echo '=== [prod] schema build complete; baseline recorded in schema_migrations ==='
\echo '=== [prod] DB is CLEAN: no clients, owners, units, or demo master data. ==='
\echo '=== [prod] The four managerial role templates (SuperAdmin/Sales/Finance/Tech) ARE present (migration 0053). ==='
\echo '=== [prod] NEXT (required): create the bootstrap admin -> run infra/db/seed.prod.sql (see docs/deployment.md Phase C). ==='
