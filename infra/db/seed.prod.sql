-- ============================================================================
-- KAZA — PRODUCTION bootstrap admin seed (MANUAL, run ONCE).
-- ----------------------------------------------------------------------------
-- WHY THIS EXISTS:
--   A production DB must start CLEAN — no seeded clients, owners, units, or demo
--   master data (those come from 0008/0046/0047, all excluded by init.prod.sql).
--   But the platform still needs at least one administrator to log in and run the
--   business. The dev admins (migration 0008) use the PUBLIC password 'Admin@1234'
--   and MUST NOT exist in production. This file creates a single real SuperAdmin
--   with a password YOU supply, so no secret is ever committed to git.
--
-- The four managerial ROLE TEMPLATES (SuperAdmin/Sales/Finance/Tech) already exist
-- (seeded by migration 0053). The fixed SuperAdmin template UUID is referenced below.
-- Additional Sales/Finance/Tech *accounts* should be created in-app by this
-- SuperAdmin (proper flow, rotated passwords) — or uncomment the block at the end.
--
-- HOW TO RUN (from /opt/kaza/app, after first boot):
--   1) Generate a BCrypt (cost 12) hash for your chosen password, e.g.:
--        htpasswd -bnBC 12 "" 'YourStrongPassword' | tr -d ':\n' | sed 's/^\$2y/\$2a/'
--      (BCrypt.Net verifies $2a/$2b/$2y; the sed normalises to $2a like the app.)
--   2) Run, passing your values as psql variables (nothing is stored on disk):
--        docker compose -f docker-compose.prod.yml --env-file /opt/kaza/env/.env.production \
--          exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--          -v admin_name='Owner Name' \
--          -v admin_email='admin@yourdomain.com' \
--          -v admin_password_hash='PASTE_THE_HASH_HERE' \
--          < infra/db/seed.prod.sql
--   3) Log in, then rotate/replace as needed. NEVER commit a real hash.
-- ============================================================================

INSERT INTO admin_users (name, email, password_hash, role, role_template_id, is_active, created_at, updated_at)
VALUES (
    :'admin_name',
    :'admin_email',
    :'admin_password_hash',
    'super_admin',
    '10000000-0000-0000-0000-000000000001',   -- SuperAdmin template (migration 0053)
    TRUE,
    NOW(), NOW()
)
ON CONFLICT (LOWER(email)) DO NOTHING;

\echo '=== [prod] bootstrap SuperAdmin ensured for :admin_email ==='

-- ---------------------------------------------------------------------------
-- OPTIONAL: seed Sales / Finance / Tech managerial accounts too.
-- Prefer creating these in-app from the SuperAdmin account. If you must seed
-- them, supply separate hashes and uncomment (template UUIDs are from 0053):
--   Sales   -> 10000000-0000-0000-0000-000000000002
--   Finance -> 10000000-0000-0000-0000-000000000003
--   Tech    -> 10000000-0000-0000-0000-000000000004
-- ---------------------------------------------------------------------------
