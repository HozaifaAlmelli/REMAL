DO $$
DECLARE
    canonical_count INTEGER;
    index_is_unique BOOLEAN;
    index_is_valid BOOLEAN;
    index_is_ready BOOLEAN;
    index_method TEXT;
    index_key_count SMALLINT;
    index_attribute_count SMALLINT;
    index_keys SMALLINT[];
    expected_key SMALLINT;
    predicate_expression TEXT;
BEGIN
    SELECT count(*)
    INTO canonical_count
    FROM pg_catalog.pg_class index_class
    JOIN pg_catalog.pg_namespace index_namespace
      ON index_namespace.oid = index_class.relnamespace
    WHERE index_namespace.nspname = 'public'
      AND index_class.relname = 'ux_bookings_external_reference'
      AND index_class.relkind = 'i';

    IF canonical_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one public.ux_bookings_external_reference index, found %',
            canonical_count;
    END IF;

    SELECT
        index_catalog.indisunique,
        index_catalog.indisvalid,
        index_catalog.indisready,
        access_method.amname,
        index_catalog.indnkeyatts,
        index_catalog.indnatts,
        index_catalog.indkey::SMALLINT[],
        table_column.attnum,
        regexp_replace(
            lower(pg_catalog.pg_get_expr(index_catalog.indpred, index_catalog.indrelid)),
            '[[:space:]()]',
            '',
            'g')
    INTO
        index_is_unique,
        index_is_valid,
        index_is_ready,
        index_method,
        index_key_count,
        index_attribute_count,
        index_keys,
        expected_key,
        predicate_expression
    FROM pg_catalog.pg_class index_class
    JOIN pg_catalog.pg_namespace index_namespace
      ON index_namespace.oid = index_class.relnamespace
    JOIN pg_catalog.pg_index index_catalog
      ON index_catalog.indexrelid = index_class.oid
    JOIN pg_catalog.pg_class table_class
      ON table_class.oid = index_catalog.indrelid
    JOIN pg_catalog.pg_namespace table_namespace
      ON table_namespace.oid = table_class.relnamespace
    JOIN pg_catalog.pg_am access_method
      ON access_method.oid = index_class.relam
    JOIN pg_catalog.pg_attribute table_column
      ON table_column.attrelid = table_class.oid
     AND table_column.attname = 'external_reference'
     AND NOT table_column.attisdropped
    WHERE index_namespace.nspname = 'public'
      AND index_class.relname = 'ux_bookings_external_reference'
      AND table_namespace.nspname = 'public'
      AND table_class.relname = 'bookings';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Canonical external-reference index is not attached to public.bookings';
    END IF;

    IF NOT index_is_unique OR NOT index_is_valid OR NOT index_is_ready THEN
        RAISE EXCEPTION
            'Canonical external-reference index is not operational (unique=%, valid=%, ready=%)',
            index_is_unique,
            index_is_valid,
            index_is_ready;
    END IF;

    IF index_method <> 'btree' THEN
        RAISE EXCEPTION 'Canonical external-reference index uses unexpected access method %',
            index_method;
    END IF;

    IF index_key_count <> 1
       OR index_attribute_count <> 1
       OR cardinality(index_keys) <> 1
       OR index_keys[array_lower(index_keys, 1)] IS DISTINCT FROM expected_key THEN
        RAISE EXCEPTION
            'Canonical external-reference index has unexpected keys or included columns (keys=%, key_count=%, attribute_count=%)',
            index_keys,
            index_key_count,
            index_attribute_count;
    END IF;

    IF predicate_expression IS DISTINCT FROM 'external_referenceisnotnull' THEN
        RAISE EXCEPTION 'Canonical external-reference index has unexpected predicate %',
            predicate_expression;
    END IF;

    IF to_regclass('public.ux_bookings_external_reference__build') IS NOT NULL THEN
        RAISE EXCEPTION 'Temporary external-reference build index remains after migration';
    END IF;
END $$;
