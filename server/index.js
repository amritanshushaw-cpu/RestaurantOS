/**
 * RestaurantOS — Express API Server
 * Connects frontend to Supabase PostgreSQL with role-based access control.
 * Endpoints: Auth, Menu, Orders, Tables, KDS, Payments, Analytics
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Supabase Clients ──────────────────────────────────────────────────────────
// anon client — respects RLS (used for user-initiated requests)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
// service-role client — bypasses RLS (used for admin/server-side operations)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://restaurant-os-woad.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Rate limiting — 100 req / 15 min per IP
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true });
app.use(limiter);

// ── Auth Middleware ───────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized — no token' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  // Fetch user's role from profiles table
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name, restaurant_id')
    .eq('id', user.id)
    .single();

  req.user = { ...user, role: profile?.role || 'Customer', profile };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: `Access denied — requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    // Use supabaseAdmin to bypass RLS for a simple connectivity check
    const { error } = await supabaseAdmin.from('restaurants').select('id').limit(1);
    res.json({
      status: 'ok',
      database: error ? 'error' : 'connected',
      error_detail: error ? error.message : null,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/auth/signup — create new account
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: full_name || email.split('@')[0], role: role || 'Customer' } }
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Check your email to confirm signup', user: data.user });
});

// POST /api/auth/signin — sign in with email+password
app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  // Fetch profile for role info
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  res.json({ session: data.session, user: data.user, profile });
});

// POST /api/auth/signout — sign out
app.post('/api/auth/signout', requireAuth, async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  await supabase.auth.admin?.signOut(token);
  res.json({ message: 'Signed out successfully' });
});

// GET /api/auth/me — get current user profile
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();
  if (error) return res.status(404).json({ error: 'Profile not found' });
  res.json({ user: req.user, profile });
});

// PATCH /api/auth/me/role — manager can change anyone's role
app.patch('/api/auth/me/role', requireAuth, requireRole('Manager'), async (req, res) => {
  const { user_id, role } = req.body;
  const validRoles = ['Customer', 'Waiter', 'Kitchen', 'Manager'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', user_id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ profile: data });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MENU ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/menu — public, no auth needed
app.get('/api/menu', async (req, res) => {
  const { data: categories, error: catErr } = await supabase
    .from('menu_categories')
    .select('*')
    .order('display_order');

  const { data: items, error: itemErr } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_available', true)
    .order('name');

  if (catErr || itemErr) return res.status(500).json({ error: 'Failed to load menu' });
  res.json({ categories, items });
});

// POST /api/menu/items — Manager only
app.post('/api/menu/items', requireAuth, requireRole('Manager'), async (req, res) => {
  const { name, description, price, category_id, image_url } = req.body;
  if (!name || !price || !category_id) return res.status(400).json({ error: 'name, price, category_id required' });

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .insert({ name, description, price, category_id, image_url, is_available: true })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ item: data });
});

// PATCH /api/menu/items/:id — Manager only
app.patch('/api/menu/items/:id', requireAuth, requireRole('Manager'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ item: data });
});

// DELETE /api/menu/items/:id — Manager only
app.delete('/api/menu/items/:id', requireAuth, requireRole('Manager'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('menu_items')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Item deleted' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/tables — all staff can view
app.get('/api/tables', requireAuth, requireRole('Manager', 'Waiter', 'Kitchen', 'Customer'), async (req, res) => {
  const { data, error } = await supabase.from('dining_tables').select('*').order('table_number');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ tables: data });
});

// POST /api/tables/book — Customer books a table (generates session_id)
app.post('/api/tables/book', requireAuth, async (req, res) => {
  const { table_id } = req.body;
  if (!table_id) return res.status(400).json({ error: 'table_id required' });

  // Check table is still available
  const { data: table } = await supabaseAdmin
    .from('dining_tables')
    .select('*')
    .eq('id', table_id)
    .single();

  if (!table) return res.status(404).json({ error: 'Table not found' });
  if (table.status !== 'AVAILABLE') return res.status(409).json({ error: 'Table is not available' });

  const session_id = Math.random().toString(36).substr(2, 6).toUpperCase();

  const { data, error } = await supabaseAdmin
    .from('dining_tables')
    .update({ status: 'OCCUPIED', session_id, customer_id: req.user.id })
    .eq('id', table_id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ table: data, session_id });
});

// PATCH /api/tables/:id/status — Waiter or Manager
app.patch('/api/tables/:id/status', requireAuth, requireRole('Manager', 'Waiter'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const update = { status };
  if (status === 'AVAILABLE') { update.session_id = null; update.customer_id = null; }

  const { data, error } = await supabaseAdmin
    .from('dining_tables')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ table: data });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/orders — Customer places order
app.post('/api/orders', requireAuth, async (req, res) => {
  const { table_id, items, notes } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'No items in order' });

  // Generate order number
  const order_number = 'ORD-' + Date.now().toString().slice(-6);

  const subtotal = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const tax = parseFloat((subtotal * 0.05).toFixed(2));
  const total = parseFloat((subtotal + tax).toFixed(2));

  // Create order
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .insert({
      table_id, order_number, subtotal, tax, total,
      customer_id: req.user.id,
      status: 'NEW', order_type: 'DINE_IN'
    })
    .select()
    .single();
  if (orderErr) return res.status(400).json({ error: orderErr.message });

  // Insert order items
  const orderItems = items.map(i => ({
    order_id: order.id,
    menu_item_id: i.menu_item_id,
    item_name: i.item_name,
    quantity: i.quantity,
    unit_price: i.unit_price,
    subtotal: i.unit_price * i.quantity,
    notes: i.notes || null
  }));

  const { error: itemErr } = await supabaseAdmin.from('order_items').insert(orderItems);
  if (itemErr) return res.status(400).json({ error: itemErr.message });

  res.status(201).json({ order, items: orderItems });
});

// GET /api/orders — Waiter/Kitchen/Manager
app.get('/api/orders', requireAuth, requireRole('Manager', 'Waiter', 'Kitchen'), async (req, res) => {
  const { status } = req.query;
  let query = supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data });
});

// GET /api/orders/my — Customer's own orders
app.get('/api/orders/my', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('customer_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data });
});

// PATCH /api/orders/:id/status — Waiter or Kitchen updates order status
app.patch('/api/orders/:id/status', requireAuth, requireRole('Manager', 'Waiter', 'Kitchen'), async (req, res) => {
  const { status } = req.body;
  const valid = ['NEW', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ order: data });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/payments — Process payment
app.post('/api/payments', requireAuth, async (req, res) => {
  const { order_id, payment_method, amount, card_last_four } = req.body;
  if (!order_id || !payment_method || !amount) {
    return res.status(400).json({ error: 'order_id, payment_method, amount required' });
  }

  const transaction_reference = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();

  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .insert({
      order_id, transaction_reference, payment_method,
      amount: parseFloat(amount),
      status: 'APPROVED',
      card_last_four: card_last_four || null
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Auto-mark order as PAID
  await supabaseAdmin
    .from('orders')
    .update({ status: 'PAID', updated_at: new Date().toISOString() })
    .eq('id', order_id);

  res.status(201).json({ payment: data, message: 'Payment approved' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KDS (KITCHEN DISPLAY SYSTEM) ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/kds — Active orders for kitchen
app.get('/api/kds', requireAuth, requireRole('Kitchen', 'Manager'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*), dining_tables(table_number)')
    .in('status', ['NEW', 'PREPARING'])
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ tickets: data });
});

// PATCH /api/kds/:order_id/mark-preparing — Kitchen marks as preparing
app.patch('/api/kds/:order_id/mark-preparing', requireAuth, requireRole('Kitchen', 'Manager'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status: 'PREPARING', updated_at: new Date().toISOString() })
    .eq('id', req.params.order_id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ order: data });
});

// PATCH /api/kds/:order_id/mark-ready — Kitchen marks as ready
app.patch('/api/kds/:order_id/mark-ready', requireAuth, requireRole('Kitchen', 'Manager'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status: 'READY', updated_at: new Date().toISOString() })
    .eq('id', req.params.order_id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ order: data });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS ROUTES (Manager only)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/analytics/summary
app.get('/api/analytics/summary', requireAuth, requireRole('Manager'), async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersRes, paymentsRes, tablesRes, itemsRes] = await Promise.all([
    supabaseAdmin.from('orders').select('id, total, status, created_at').gte('created_at', today.toISOString()),
    supabaseAdmin.from('payment_transactions').select('amount, payment_method').gte('created_at', today.toISOString()),
    supabaseAdmin.from('dining_tables').select('status'),
    supabaseAdmin.from('order_items').select('item_name, quantity').gte('created_at', today.toISOString())
  ]);

  const orders = ordersRes.data || [];
  const payments = paymentsRes.data || [];
  const tables = tablesRes.data || [];

  const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const occupiedTables = tables.filter(t => t.status === 'OCCUPIED').length;
  const availableTables = tables.filter(t => t.status === 'AVAILABLE').length;

  // Top selling items
  const itemCounts = {};
  (itemsRes.data || []).forEach(i => {
    itemCounts[i.item_name] = (itemCounts[i.item_name] || 0) + i.quantity;
  });
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  res.json({
    today: {
      revenue: parseFloat(revenue.toFixed(2)),
      orders: orders.length,
      paid_orders: orders.filter(o => o.status === 'PAID').length,
      avg_order: orders.length ? parseFloat((revenue / orders.length).toFixed(2)) : 0
    },
    tables: { occupied: occupiedTables, available: availableTables, total: tables.length },
    top_items: topItems,
    payment_breakdown: {
      card: payments.filter(p => p.payment_method === 'CARD').reduce((s, p) => s + Number(p.amount), 0),
      upi: payments.filter(p => p.payment_method === 'UPI').reduce((s, p) => s + Number(p.amount), 0),
      cash: payments.filter(p => p.payment_method === 'CASH').reduce((s, p) => s + Number(p.amount), 0)
    }
  });
});

// GET /api/analytics/orders-history — paginated order history
app.get('/api/analytics/orders-history', requireAuth, requireRole('Manager'), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('orders')
    .select('*, payment_transactions(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data, total: count, page, pages: Math.ceil(count / limit) });
});

// ── 404 & Error Handler ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🍽️  RestaurantOS API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Supabase:     ${process.env.SUPABASE_URL || '❌ not configured'}\n`);
});
