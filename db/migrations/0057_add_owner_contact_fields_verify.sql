-- Verify owner contact fields required by the production Owner entity.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'owners'
          AND column_name = 'emergency_phone'
          AND data_type = 'character varying'
          AND character_maximum_length = 30
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'owners.emergency_phone column is missing or has incorrect type/nullability';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'owners'
          AND column_name = 'detailed_address'
          AND data_type = 'text'
          AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION 'owners.detailed_address column is missing or has incorrect type/nullability';
    END IF;
END $$;
