-- ============================================
-- Kaza Booking Platform — Combined DB Init Script
-- Runs all migrations in order on first start
-- ============================================

\echo '=== Running migration 0001: init postgres conventions ==='
\i /docker-entrypoint-initdb.d/migrations/0001_init_postgres_conventions.sql

\echo '=== Running migration 0002: create amenities ==='
\i /docker-entrypoint-initdb.d/migrations/0002_create_amenities.sql

\echo '=== Running migration 0003: create areas ==='
\i /docker-entrypoint-initdb.d/migrations/0003_create_areas.sql

\echo '=== Running migration 0004: create admin users ==='
\i /docker-entrypoint-initdb.d/migrations/0004_create_admin_users.sql

\echo '=== Running migration 0005: create clients ==='
\i /docker-entrypoint-initdb.d/migrations/0005_create_clients.sql

\echo '=== Running migration 0006: create owners ==='
\i /docker-entrypoint-initdb.d/migrations/0006_create_owners.sql

\echo '=== Running migration 0007: master data integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0007_master_data_integrity_cleanup.sql

\echo '=== Running migration 0008: seed dev master data ==='
\i /docker-entrypoint-initdb.d/migrations/0008_seed_dev_master_data.sql

\echo '=== Running migration 0009: add owner password hash ==='
\i /docker-entrypoint-initdb.d/migrations/0009_add_owner_password_hash_to_owners.sql

\echo '=== Running migration 0010: create units ==='
\i /docker-entrypoint-initdb.d/migrations/0010_create_units.sql

\echo '=== Running migration 0011: create unit_images ==='
\i /docker-entrypoint-initdb.d/migrations/0011_create_unit_images.sql

\echo '=== Running migration 0012: create unit_amenities ==='
\i /docker-entrypoint-initdb.d/migrations/0012_create_unit_amenities.sql

\echo '=== Running migration 0013: create seasonal_pricing ==='
\i /docker-entrypoint-initdb.d/migrations/0013_create_seasonal_pricing.sql

\echo '=== Running migration 0014: create date_blocks ==='
\i /docker-entrypoint-initdb.d/migrations/0014_create_date_blocks.sql

\echo '=== Running migration 0015: units availability integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0015_units_availability_integrity_cleanup.sql


\echo '=== Running migration 0016: create bookings ==='
\i /docker-entrypoint-initdb.d/migrations/0016_create_bookings.sql

\echo '=== Running migration 0017: create booking status history ==='
\i /docker-entrypoint-initdb.d/migrations/0017_create_booking_status_history.sql

\echo '=== Running migration 0018: create crm leads ==='
\i /docker-entrypoint-initdb.d/migrations/0018_create_crm_leads.sql

\echo '=== Running migration 0019: create crm notes ==='
\i /docker-entrypoint-initdb.d/migrations/0019_create_crm_notes.sql

\echo '=== Running migration 0020: create crm assignments ==='
\i /docker-entrypoint-initdb.d/migrations/0020_create_crm_assignments.sql

\echo '=== Running migration 0021: booking crm integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0021_booking_crm_integrity_cleanup.sql

\echo '=== Running migration 0022: create payments ==='
\i /docker-entrypoint-initdb.d/migrations/0022_create_payments.sql

\echo '=== Running migration 0023: create invoices ==='
\i /docker-entrypoint-initdb.d/migrations/0023_create_invoices.sql

\echo '=== Running migration 0024: create invoice items ==='
\i /docker-entrypoint-initdb.d/migrations/0024_create_invoice_items.sql

\echo '=== Running migration 0025: create owner payouts ==='
\i /docker-entrypoint-initdb.d/migrations/0025_create_owner_payouts.sql

\echo '=== Running migration 0026: payments finance integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0026_payments_finance_integrity_cleanup.sql

\echo '=== Running migration 0027: create owner portal units overview view ==='
\i /docker-entrypoint-initdb.d/migrations/0027_create_owner_portal_units_overview_view.sql

\echo '=== Running migration 0028: create owner portal bookings overview view ==='
\i /docker-entrypoint-initdb.d/migrations/0028_create_owner_portal_bookings_overview_view.sql

\echo '=== Running migration 0029: create owner portal finance overview view ==='
\i /docker-entrypoint-initdb.d/migrations/0029_create_owner_portal_finance_overview_view.sql

\echo '=== Running migration 0030: owner portal integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0030_owner_portal_integrity_cleanup.sql

\echo '=== Running migration 0031: create reviews ==='
\i /docker-entrypoint-initdb.d/migrations/0031_create_reviews.sql

\echo '=== Running migration 0032: create review status history ==='
\i /docker-entrypoint-initdb.d/migrations/0032_create_review_status_history.sql

\echo '=== Running migration 0033: create unit review summaries ==='
\i /docker-entrypoint-initdb.d/migrations/0033_create_unit_review_summaries.sql

\echo '=== Running migration 0034: create review replies ==='
\i /docker-entrypoint-initdb.d/migrations/0034_create_review_replies.sql

\echo '=== Running migration 0035: reviews ratings integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0035_reviews_ratings_integrity_cleanup.sql

\echo '=== Running migration 0036: create notification templates ==='
\i /docker-entrypoint-initdb.d/migrations/0036_create_notification_templates.sql

\echo '=== Running migration 0037: create notifications ==='
\i /docker-entrypoint-initdb.d/migrations/0037_create_notifications.sql

\echo '=== Running migration 0038: create notification delivery logs ==='
\i /docker-entrypoint-initdb.d/migrations/0038_create_notification_delivery_logs.sql

\echo '=== Running migration 0039: create notification preferences ==='
\i /docker-entrypoint-initdb.d/migrations/0039_create_notification_preferences.sql

\echo '=== Running migration 0040: notifications alerts integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0040_notifications_alerts_integrity_cleanup.sql

\echo '=== Running migration 0041: create reporting booking daily summary view ==='
\i /docker-entrypoint-initdb.d/migrations/0041_create_reporting_booking_daily_summary_view.sql

\echo '=== Running migration 0042: create reporting finance daily summary view ==='
\i /docker-entrypoint-initdb.d/migrations/0042_create_reporting_finance_daily_summary_view.sql

\echo '=== Running migration 0043: create reporting reviews daily summary view ==='
\i /docker-entrypoint-initdb.d/migrations/0043_create_reporting_reviews_daily_summary_view.sql

\echo '=== Running migration 0044: create reporting notifications daily summary view ==='
\i /docker-entrypoint-initdb.d/migrations/0044_create_reporting_notifications_daily_summary_view.sql

\echo '=== Running migration 0045: reports analytics integrity cleanup ==='
\i /docker-entrypoint-initdb.d/migrations/0045_reports_analytics_integrity_cleanup.sql

-- 0046 is intentionally excluded: it is a heavy transactional demo dataset.
-- 0047 seeds only the minimal portal login accounts required for local access.
\echo '=== Running migration 0047: seed minimal dev login users (owners + clients) ==='
\i /docker-entrypoint-initdb.d/migrations/0047_seed_minimal_dev_login.sql

\echo '=== Running migration 0048: align CRM lead pipeline ==='
\i /docker-entrypoint-initdb.d/migrations/0048_align_crm_lead_pipeline.sql

\echo '=== Running migration 0049: owner portal finance display names ==='
\i /docker-entrypoint-initdb.d/migrations/0049_owner_portal_finance_names.sql

\echo '=== Running migration 0050: add is_active flag to amenities ==='
\i /docker-entrypoint-initdb.d/migrations/0050_add_amenity_is_active.sql

\echo '=== Running migration 0051: allow superseded invoice status ==='
\i /docker-entrypoint-initdb.d/migrations/0051_allow_superseded_invoice_status.sql

\echo '=== Running migration 0052: align reporting views with current pipelines ==='
\i /docker-entrypoint-initdb.d/migrations/0052_align_reporting_views_with_pipeline.sql

\echo '=== Running migration 0053: create dynamic RBAC ==='
\i /docker-entrypoint-initdb.d/migrations/0053_create_dynamic_rbac.sql

\echo '=== Running migration 0054: rename areas domain to projects ==='
\i /docker-entrypoint-initdb.d/migrations/0054_rename_areas_to_projects.sql

\echo '=== Running migration 0055: date block approvals ==='
\i /docker-entrypoint-initdb.d/migrations/0055_date_block_approvals.sql

\echo '=== All migrations completed successfully ==='

