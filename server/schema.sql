-- ============================================================================
-- RestaurantOS — Complete PostgreSQL Schema (Run this in Supabase SQL Editor)
-- Tables: restaurants, profiles, dining_tables, menu_categories, menu_items,
--         orders, order_items, payment_transactions, inventory, queue, sessions
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. RESTAURANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL DEFAULT 'RestaurantOS',
    address         TEXT,
    phone           VARCHAR(30),
    email           VARCHAR(255),
    currency        VARCHAR(10) DEFAULT 'INR',
    tax_rate        DECIMAL(5,2) DEFAULT 5.00,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. PROFILES (linked to Supabase auth.users 1:1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id   UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(255) NOT NULL DEFAULT 'Guest',
    avatar_url      TEXT,
    role            VARCHAR(20)  NOT NULL DEFAULT 'Customer'
                        CHECK (role IN ('Customer','Waiter','Kitchen','Manager')),
    auth_provider   VARCHAR(20)  NOT NULL DEFAULT 'email',
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_restaurant ON profiles(restaurant_id);

-- ============================================================================
-- 3. DINING TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS dining_tables (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number    VARCHAR(20) NOT NULL,
    capacity        INT DEFAULT 4,
    status          VARCHAR(20) DEFAULT 'AVAILABLE'
                        CHECK (status IN ('AVAILABLE','OCCUPIED','RESERVED','CLEANING')),
    session_id      VARCHAR(10),     -- 6-digit session ID generated on booking
    customer_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tables_status ON dining_tables(status);

-- ============================================================================
-- 4. MENU CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS menu_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    display_order   INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. MENU ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    price           DECIMAL(10,2) NOT NULL,
    is_available    BOOLEAN DEFAULT TRUE,
    image_url       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_available ON menu_items(is_available);

-- ============================================================================
-- 6. ORDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id        UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
    customer_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    order_number    VARCHAR(50) NOT NULL UNIQUE,
    status          VARCHAR(30) DEFAULT 'NEW'
                        CHECK (status IN ('NEW','PREPARING','READY','SERVED','PAID','CANCELLED')),
    order_type      VARCHAR(20) DEFAULT 'DINE_IN'
                        CHECK (order_type IN ('DINE_IN','TAKEAWAY','DELIVERY')),
    subtotal        DECIMAL(10,2) NOT NULL,
    tax             DECIMAL(10,2) DEFAULT 0.00,
    total           DECIMAL(10,2) NOT NULL,
    special_notes   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);

-- ============================================================================
-- 7. ORDER ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id    UUID REFERENCES menu_items(id) ON DELETE RESTRICT,
    item_name       VARCHAR(255) NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10,2) NOT NULL,
    subtotal        DECIMAL(10,2) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================================================
-- 8. PAYMENT TRANSACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id                UUID REFERENCES orders(id) ON DELETE CASCADE,
    transaction_reference   VARCHAR(100) NOT NULL UNIQUE,
    payment_method          VARCHAR(50) NOT NULL
                                CHECK (payment_method IN ('CARD','UPI','NETBANKING','WALLET','CASH')),
    amount                  DECIMAL(10,2) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
                                CHECK (status IN ('APPROVED','DECLINED','PENDING','REFUNDED')),
    card_last_four          VARCHAR(4),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_transactions(status);

-- ============================================================================
-- 9. INVENTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    item_name       VARCHAR(255) NOT NULL,
    unit            VARCHAR(50)  DEFAULT 'kg',
    current_stock   DECIMAL(10,3) DEFAULT 0,
    reorder_level   DECIMAL(10,3) DEFAULT 5,
    cost_per_unit   DECIMAL(10,2) DEFAULT 0,
    supplier        VARCHAR(255),
    last_restocked  TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_restaurant ON inventory(restaurant_id);

-- ============================================================================
-- 10. VIRTUAL QUEUE
-- ============================================================================
CREATE TABLE IF NOT EXISTS queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_name   VARCHAR(255),
    party_size      INT DEFAULT 1,
    phone           VARCHAR(30),
    status          VARCHAR(20) DEFAULT 'WAITING'
                        CHECK (status IN ('WAITING','CALLED','SEATED','LEFT')),
    queue_position  INT,
    token_number    VARCHAR(10),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    seated_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_position ON queue(queue_position);

-- ============================================================================
-- 11. SESSIONS (table session audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      VARCHAR(10) NOT NULL UNIQUE,
    table_id        UUID REFERENCES dining_tables(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    total_billed    DECIMAL(10,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create profile when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, auth_provider, email_verified, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
        (NEW.email_confirmed_at IS NOT NULL),
        COALESCE(NEW.raw_user_meta_data->>'role', 'Customer')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Sync email_verified flag
CREATE OR REPLACE FUNCTION sync_email_verified()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Auto-update orders.updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Menu: public read
CREATE POLICY "Public can read menu categories" ON menu_categories FOR SELECT USING (true);
CREATE POLICY "Public can read available menu items" ON menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Manager can manage menu" ON menu_items FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Manager')
);

-- Tables: staff read all, manager manages
CREATE POLICY "Staff can view tables" ON dining_tables FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Staff can update table status" ON dining_tables FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Manager','Waiter'))
);

-- Orders: customers see own, staff see all
CREATE POLICY "Customers see own orders" ON orders FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Staff see all orders" ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Manager','Waiter','Kitchen'))
);
CREATE POLICY "Authenticated can place orders" ON orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can update orders" ON orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Manager','Waiter','Kitchen'))
);

-- Profiles
CREATE POLICY "Users see own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Staff see all profiles" ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('Manager','Waiter','Kitchen'))
);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Inventory: Manager and Kitchen
CREATE POLICY "Kitchen and Manager see inventory" ON inventory FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Manager','Kitchen'))
);
CREATE POLICY "Manager manages inventory" ON inventory FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Manager')
);

-- ============================================================================
-- SEED DATA — Default restaurant + menu categories
-- ============================================================================

-- Insert default restaurant (idempotent)
INSERT INTO restaurants (id, name, address, phone, email, currency, tax_rate)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'RestaurantOS @ Park Street',
    '74 Park Street Culinary Boulevard, Kolkata, WB 700016',
    '+91 98765 43210',
    'contact@restaurantos.com',
    'INR',
    5.00
) ON CONFLICT (id) DO NOTHING;

-- Default menu categories
INSERT INTO menu_categories (restaurant_id, name, display_order) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Indian Specialties', 1),
    ('00000000-0000-0000-0000-000000000001', 'Continental Specials', 2),
    ('00000000-0000-0000-0000-000000000001', 'Chinese & Asian Fusion', 3),
    ('00000000-0000-0000-0000-000000000001', 'Starters & Appetizers', 4),
    ('00000000-0000-0000-0000-000000000001', 'Drinks & Beverages', 5),
    ('00000000-0000-0000-0000-000000000001', 'Desserts & Sweets', 6)
ON CONFLICT DO NOTHING;

-- Seed 10 dining tables directly (no function needed)
INSERT INTO dining_tables (restaurant_id, table_number, capacity, status) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Table 01', 4, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 02', 4, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 03', 4, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 04', 4, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 05', 4, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 06', 6, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 07', 6, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 08', 2, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 09', 2, 'AVAILABLE'),
    ('00000000-0000-0000-0000-000000000001', 'Table 10', 8, 'AVAILABLE')
ON CONFLICT DO NOTHING;
