-- ============================================================================
-- RestaurantOS - Generalized Table Seeding Script
-- Creates N dining tables for a given restaurant, all starting AVAILABLE
-- (vacant). Default is 10 tables. Idempotent: safe to re-run, will not
-- create duplicates for a restaurant that already has tables seeded.
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_dining_tables(
    p_restaurant_id UUID,
    p_table_count INT DEFAULT 10,
    p_default_capacity INT DEFAULT 4
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    existing_count INT;
    i INT;
BEGIN
    SELECT COUNT(*) INTO existing_count
    FROM dining_tables
    WHERE restaurant_id = p_restaurant_id;

    IF existing_count > 0 THEN
        RAISE NOTICE 'Restaurant % already has % table(s) -- skipping seed.', p_restaurant_id, existing_count;
        RETURN;
    END IF;

    FOR i IN 1..p_table_count LOOP
        INSERT INTO dining_tables (restaurant_id, table_number, capacity, status)
        VALUES (
            p_restaurant_id,
            'Table ' || LPAD(i::TEXT, 2, '0'),
            p_default_capacity,
            'AVAILABLE'
        );
    END LOOP;

    RAISE NOTICE 'Seeded % vacant tables for restaurant %.', p_table_count, p_restaurant_id;
END;
$$;

-- Example usage (run manually with your real restaurant id):
--   SELECT seed_dining_tables('00000000-0000-0000-0000-000000000000');
--   -- or with a custom count:
--   SELECT seed_dining_tables('00000000-0000-0000-0000-000000000000', 12, 6);
