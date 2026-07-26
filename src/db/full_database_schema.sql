-- ============================================================================
-- RestaurantOS - PostgreSQL / Supabase Relational Database Schema
-- Tables: restaurants, dining_tables, menu_categories, menu_items, orders, order_items, payments
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Restaurants Table
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    tax_rate DECIMAL(5,2) DEFAULT 5.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Dining Tables Table
CREATE TABLE IF NOT EXISTS dining_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(20) NOT NULL,
    capacity INT DEFAULT 4,
    status VARCHAR(20) DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Menu Categories Table
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Orders Table (POS & Online Checkout)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(30) DEFAULT 'NEW', -- 'NEW', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED'
    order_type VARCHAR(20) DEFAULT 'DINE_IN', -- 'DINE_IN', 'TAKEAWAY', 'DELIVERY'
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    transaction_reference VARCHAR(100) NOT NULL UNIQUE,
    payment_method VARCHAR(50) NOT NULL, -- 'CARD', 'UPI', 'NETBANKING', 'WALLET'
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'APPROVED', 'DECLINED', 'PENDING'
    card_last_four VARCHAR(4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_dining_tables_status ON dining_tables(status);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payment_transactions(order_id);

-- Row Level Security (RLS) Enablement
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
-- ============================================================================
-- RestaurantOS - Authentication Schema
-- Adds: profiles table (linked to Supabase's built-in auth.users),
-- an auto-provisioning trigger, and RLS policies.
--
-- Email OTP verification and Google OAuth are both handled natively by
-- Supabase Auth (auth.users + GoTrue) -- no custom OTP table is required.
-- This keeps the backend generalized: it works against ANY Supabase
-- project with Email and Google providers enabled, with no hardcoded
-- restaurant, user, or demo data baked into the schema itself.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
-- One row per authenticated user (both Google OAuth and Email/OTP users land here).
-- id matches auth.users.id 1:1.
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL DEFAULT 'Guest',
    avatar_url TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'Customer', -- 'Customer', 'Waiter', 'Kitchen', 'Manager'
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'email', -- 'email', 'google'
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_profiles_role CHECK (role IN ('Customer','Waiter','Kitchen','Manager'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_restaurant ON profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. Auto-provisioning trigger
-- Whenever Supabase Auth creates a new auth.users row (Google sign-in,
-- email/password sign-up, or first successful OTP verification), this
-- automatically creates a matching profiles row. This is what makes the
-- backend "generalized" -- no client-side code has to remember to insert
-- a profile; it happens at the database layer for every auth method.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, auth_provider, email_verified)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
        (NEW.email_confirmed_at IS NOT NULL)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- 3. Keep profiles.email_verified in sync if a user verifies later
-- (e.g. completes email OTP after initial row creation).
CREATE OR REPLACE FUNCTION sync_email_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL) THEN
        UPDATE public.profiles SET email_verified = TRUE, updated_at = NOW() WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION sync_email_verified();

-- 4. Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Staff can view all profiles" ON profiles;
CREATE POLICY "Staff can view all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('Manager','Waiter','Kitchen')
        )
    );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Managers can update any profile" ON profiles;
CREATE POLICY "Managers can update any profile"
    ON profiles FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Manager')
    );

-- ============================================================================
-- Enable auth providers (run once in Supabase Dashboard, not via SQL):
--   Authentication > Providers > Email: enable "Confirm email" (OTP)
--   Authentication > Providers > Google: paste Client ID + Client Secret
--   Authentication > URL Configuration: add your deployed site URL to
--     "Redirect URLs" or Google OAuth will fail with redirect_uri_mismatch.
-- ============================================================================
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
