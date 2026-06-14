-- ============================================================================
-- Migration:   0047_seed_minimal_dev_login
-- Title:       Seed minimal dev login accounts for the owner & client portals
-- Database:    PostgreSQL 16
-- Depends on:  0005 (clients), 0006 (owners), 0009 (owners.password_hash)
-- Created:     2026-06-15
-- ============================================================================
--
-- PURPOSE:
--   The combined init script seeds the four ADMIN logins via 0008, but NOT the
--   heavy sample dataset in 0046 (owners, clients, units, bookings). This adds
--   ONLY the owner/client *login* rows so every portal is reachable on a fresh
--   volume, while the DB stays free of transactional sample data. Add real
--   units/bookings manually.
--
--   DEV CREDENTIALS (all BCrypt cost-12 hash of 'Admin@1234'):
--     OWNER  (phone login):  +201001234567 (Ahmed Hassan)
--                            +201009876543 (Mohamed Ali)
--     CLIENT (phone login):  +201111111111 (Sara El-Sayed)
--                            +201222222222 (Khaled Ibrahim)
--                            +201333333333 (Nour Mahmoud)
-- ============================================================================

BEGIN;

-- Dev owners (phone login)
INSERT INTO owners (id, name, phone, email, commission_rate, notes, status, password_hash, created_at, updated_at)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'Ahmed Hassan',
        '+201001234567',
        'ahmed.owner@kazabooking.dev',
        10.00,
        'Dev/test owner login.',
        'active',
        '$2a$12$4.qulKpTtx0cQYeHmv.sgeGpeYM0/86IFEfgfhWuwuQT1JC.aFZQ6',
        NOW(), NOW()
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'Mohamed Ali',
        '+201009876543',
        'mohamed.owner@kazabooking.dev',
        15.00,
        'Dev/test owner login.',
        'active',
        '$2a$12$4.qulKpTtx0cQYeHmv.sgeGpeYM0/86IFEfgfhWuwuQT1JC.aFZQ6',
        NOW(), NOW()
    )
ON CONFLICT (phone) DO NOTHING;

-- Dev clients / guests (phone login)
INSERT INTO clients (id, name, phone, email, password_hash, is_active, created_at, updated_at)
VALUES
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Sara El-Sayed',
        '+201111111111',
        'sara.guest@kazabooking.dev',
        '$2a$12$4.qulKpTtx0cQYeHmv.sgeGpeYM0/86IFEfgfhWuwuQT1JC.aFZQ6',
        true,
        NOW(), NOW()
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Khaled Ibrahim',
        '+201222222222',
        'khaled.guest@kazabooking.dev',
        '$2a$12$4.qulKpTtx0cQYeHmv.sgeGpeYM0/86IFEfgfhWuwuQT1JC.aFZQ6',
        true,
        NOW(), NOW()
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Nour Mahmoud',
        '+201333333333',
        'nour.guest@kazabooking.dev',
        '$2a$12$4.qulKpTtx0cQYeHmv.sgeGpeYM0/86IFEfgfhWuwuQT1JC.aFZQ6',
        true,
        NOW(), NOW()
    )
ON CONFLICT (phone) DO NOTHING;

COMMIT;
