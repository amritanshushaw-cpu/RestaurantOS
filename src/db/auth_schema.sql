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
