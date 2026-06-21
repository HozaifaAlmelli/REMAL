BEGIN;

-- Safely detach the added owner contact columns.
ALTER TABLE owners DROP COLUMN IF EXISTS emergency_phone;
ALTER TABLE owners DROP COLUMN IF EXISTS detailed_address;

COMMIT;
