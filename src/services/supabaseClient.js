/**
 * RestaurantOS - Real Dynamic Database & State Management Engine
 * Handles full CRUD operations (Create, Read, Update, Delete) with LocalStorage persistence.
 */

const STORAGE_KEYS = {
  MENU: 'rest_os_menu_items',
  CATEGORIES: 'rest_os_categories',
  INVENTORY: 'rest_os_inventory',
  ORDERS: 'rest_os_orders',
  QUEUE: 'rest_os_queue',
  TABLES: 'rest_os_tables',
  PAYMENTS: 'rest_os_payments',
  SESSIONS: 'rest_os_sessions',
  CUSTOMER_HISTORY: 'rest_os_customer_history',
  TABLE_VACANCY: 'rest_os_table_vacancy'
};

class DynamicDatabaseEngine {
  constructor() {
    // Real credentials come from src/config.js (window.SUPABASE_URL / SUPABASE_ANON_KEY).
    // No fake project fallback: if unset, the app runs in local-only demo
    // mode and hasValidSupabaseConfig() reports that honestly instead of
    // pretending to be connected to a dead placeholder project.
    this.supabaseUrl = (window.SUPABASE_URL || '').trim();
    this.supabaseAnonKey = (window.SUPABASE_ANON_KEY || '').trim();
    this.supabase = this.initSupabaseClient();
    this.initDefaultState();
  }

  initSupabaseClient() {
    if (!this.hasValidSupabaseConfig()) return null;
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        const client = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        setTimeout(() => this.setupRealtimeSync(client), 150);
        return client;
      } catch (err) {
        console.warn('Supabase client initialization notice:', err.message);
      }
    }
    return null;
  }

  setupRealtimeSync(client) {
    if (!client) return;
    try {
      this.realtimeChannel = client.channel('restaurant-os-cloud-live');
      this.realtimeChannel
        .on('broadcast', { event: 'order_sync' }, (payload) => {
          if (payload?.payload?.order) {
            this.handleRemoteOrderSync(payload.payload.order);
          }
        })
        .on('broadcast', { event: 'session_sync' }, (payload) => {
          if (payload?.payload?.session) {
            this.handleRemoteSessionSync(payload.payload.session);
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.info('⚡ RestaurantOS: Multi-Device Cloud Realtime Channel Subscribed!');
          }
        });
    } catch (e) {
      console.warn('Realtime channel notice:', e.message);
    }
  }

  broadcastOrderSync(order) {
    if (!order) return;
    try {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('rest_os_order_sync', { detail: order }));
    } catch (e) {}
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.send({
          type: 'broadcast',
          event: 'order_sync',
          payload: { order }
        });
      } catch (e) {}
    }
  }

  broadcastSessionSync(session) {
    if (!session) return;
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.send({
          type: 'broadcast',
          event: 'session_sync',
          payload: { session }
        });
      } catch (e) {}
    }
  }

  handleRemoteOrderSync(remoteOrder) {
    if (!remoteOrder || !remoteOrder.id) return;
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === remoteOrder.id || o.order_number === remoteOrder.order_number);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...remoteOrder };
    } else {
      orders.unshift(remoteOrder);
    }
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    try { window.dispatchEvent(new Event('storage')); } catch (e) {}
  }

  handleRemoteSessionSync(remoteSession) {
    if (!remoteSession || !remoteSession.session_id) return;
    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.session_id === remoteSession.session_id);
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], ...remoteSession };
    } else {
      sessions.unshift(remoteSession);
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    try { window.dispatchEvent(new Event('storage')); } catch (e) {}
  }

  // True only when real credentials are present. This is checked by
  // authService.js before attempting any real Google/email/OTP auth call,
  // so the app can clearly communicate "backend not configured" instead of
  // silently falling back to something that looks connected but isn't.
  hasValidSupabaseConfig() {
    return !!(this.supabaseUrl && /^https:\/\/.+\.supabase\.co$/.test(this.supabaseUrl) && this.supabaseAnonKey && this.supabaseAnonKey.length > 20);
  }

  // Generalized profile sync -- matches the real `profiles` table defined
  // in src/db/auth_schema.sql. Works for any restaurant/user, not tied to
  // demo data. Note: for Google/email/OTP sign-in, Supabase's own
  // on_auth_user_created trigger already creates the profile row
  // automatically; this call is what keeps role/name updates (e.g. a role
  // switch in the navbar) written back to the same row afterwards.
  async syncUserProfile(user) {
    if (!user) return;
    localStorage.setItem('rest_os_user_profile', JSON.stringify(user));
    if (this.supabase && this.hasValidSupabaseConfig()) {
      try {
        const { error } = await this.supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: user.name,
          avatar_url: user.picture || null,
          role: user.role,
          auth_provider: user.auth_provider || 'email',
          email_verified: user.email_verified !== false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) console.warn('Supabase profile sync error:', error.message);
      } catch (e) {
        console.warn('Supabase profile sync notice:', e.message);
      }
    }
  }

  // Initialize or load state from localStorage
  initDefaultState() {
    const APP_VERSION = 'rest_os_v3_1_fresh_zero_vacant';
    if (!localStorage.getItem(APP_VERSION)) {
      // Clean slate: wipe lingering demo data and stale active sessions
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
      localStorage.removeItem(STORAGE_KEYS.TABLES);
      localStorage.removeItem(STORAGE_KEYS.QUEUE);
      localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
      localStorage.removeItem('rest_os_staff_presence');
      localStorage.removeItem('rest_os_active_session');
      localStorage.setItem(APP_VERSION, 'true');
    }
    const defaultCategories = [
      { id: 'cat-05', name: 'Indian Specialties', display_order: 1 },
      { id: 'cat-continental', name: 'Continental Specials', display_order: 2 },
      { id: 'cat-chinese', name: 'Chinese & Asian Fusion', display_order: 3 },
      { id: 'cat-01', name: 'Starters & Appetizers', display_order: 4 },
      { id: 'cat-03', name: 'Drinks & Beverages', display_order: 5 },
      { id: 'cat-04', name: 'Desserts & Sweets', display_order: 6 }
    ];

    const defaultMenuItems = [
      // --- DEDICATED INDIAN SPECIALTIES (20 DISHES) ---
      { id: 'item-ind-01', category_id: 'cat-05', name: 'Butter Chicken (Murgh Makhani)', description: 'Tender tandoori chicken simmered in rich creamy tomato butter gravy', price: 480.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-02', category_id: 'cat-05', name: 'Paneer Butter Masala', description: 'Soft cottage cheese cubes cooked in rich cashew and spiced tomato gravy', price: 420.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-03', category_id: 'cat-05', name: 'Hyderabadi Chicken Dum Biryani', description: 'Fragrant basmati rice layered with spiced chicken, saffron, caramelised onions & mint', price: 490.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-04', category_id: 'cat-05', name: 'Dal Makhani', description: 'Slow-cooked black lentils simmered overnight with white butter & fresh cream', price: 360.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-05', category_id: 'cat-05', name: 'Mutton Rogan Josh', description: 'Slow-cooked Kashmiri lamb curry infused with rattan jot, fennel & aromatic spices', price: 580.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1545247181-516773cae754?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-06', category_id: 'cat-05', name: 'Palak Paneer', description: 'Fresh cottage cheese cubes cooked in smooth garlic-infused spinach gravy', price: 390.00, is_available: true, image_url: 'https://png.pngtree.com/thumb_back/fh260/background/20241007/pngtree-close-up-of-a-bowl-of-palak-paneer-image_16340453.jpg' },
      { id: 'item-ind-07', category_id: 'cat-05', name: 'Kolkata Mutton Biryani', description: 'Aromatic long-grain rice cooked with succulent mutton, spiced potato & boiled egg', price: 550.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-08', category_id: 'cat-05', name: 'Malai Kofta Velvet', description: 'Golden potato & paneer dumplings stuffed with dry fruits in rich cashew velvet sauce', price: 440.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-09', category_id: 'cat-05', name: 'Chicken Tikka Masala', description: 'Charcoal-roasted chicken chunks tossed in spicy bell pepper & onion tomato gravy', price: 460.00, is_available: true, image_url: 'https://media.istockphoto.com/id/1227594550/photo/chicken-curry-creamy-chicken-butter.jpg?s=612x612&w=0&k=20&c=U9SzDx7mjCA5iS1qb8cDUNNkIGD6mJJhwLvEHXL-OlE=' },
      { id: 'item-ind-10', category_id: 'cat-05', name: 'Pindi Chole Bhature', description: 'Spiced chickpea curry served with two fluffy golden fried bhaturas & pickle', price: 320.00, is_available: true, image_url: 'https://media.istockphoto.com/id/979914742/photo/chole-bhature-or-chick-pea-curry-and-fried-puri-served-in-terracotta-crockery-over-white.jpg?s=612x612&w=0&k=20&c=OLAw-ZleN1UVaa468OlPSAc6dkz2sjehxWevbvZQNew=' },
      { id: 'item-ind-11', category_id: 'cat-05', name: 'Kadhai Paneer Special', description: 'Paneer cubes sautéed with bell peppers, onions & freshly pounded kadhai masala', price: 410.00, is_available: true, image_url: 'https://i.pinimg.com/736x/39/39/90/393990c9c0e2331e30af1eeb80d619ef.jpg' },
      { id: 'item-ind-12', category_id: 'cat-05', name: 'Garlic Butter Naan', description: 'Traditional clay oven tandoori bread brushed with fresh garlic butter & cilantro', price: 90.00, is_available: true, image_url: 'https://t4.ftcdn.net/jpg/07/18/16/87/360_F_718168709_mc2zfZw46fQxI81ifoYBEWhJwpsL5iPY.jpg' },
      { id: 'item-ind-13', category_id: 'cat-05', name: 'Amritsari Stuffed Kulcha', description: 'Crispy flatbread stuffed with spiced mashed potatoes, herbs & served with chole', price: 150.00, is_available: true, image_url: 'https://img.freepik.com/premium-photo/rich-indian-amritsari-kulcha-photo_960396-987161.jpg?w=740' },
      { id: 'item-ind-14', category_id: 'cat-05', name: 'Goan Fish Curry', description: 'Fresh sea bass cooked in tangy coconut milk, tamarind & red chili Goan sauce', price: 520.00, is_available: true, image_url: 'https://www.chefkunalkapur.com/wp-content/uploads/2023/01/DSC08225-1300x731.jpg' },
      { id: 'item-ind-15', category_id: 'cat-05', name: 'Prawn Malai Curry', description: 'Tiger prawns cooked in sweet coconut cream, mild spices & aromatic garam masala', price: 590.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-16', category_id: 'cat-05', name: 'Chettinad Chicken Curry', description: 'Fiery South Indian chicken curry cooked with freshly roasted coconut & black pepper', price: 470.00, is_available: true, image_url: 'https://i.pinimg.com/736x/e4/45/97/e44597b25046b29cc8149a7129c97970.jpg' },
      { id: 'item-ind-17', category_id: 'cat-05', name: 'Aloo Gobi Adraki', description: 'Tender cauliflower florets & potatoes sautéed with fresh julienned ginger & cumin', price: 310.00, is_available: true, image_url: 'https://masalachilli.com/wp-content/uploads/2019/02/Aloo-Gobi-Adraki-4.jpg' },
      { id: 'item-ind-18', category_id: 'cat-05', name: 'Kashmiri Paneer Chaman', description: 'Golden paneer slabs in turmeric, fennel, and dry ginger yogurt curry', price: 430.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-19', category_id: 'cat-05', name: 'Tandoori Roti Basket (2 pcs)', description: 'Whole wheat flatbread baked fresh in traditional clay tandoor oven', price: 60.00, is_available: true, image_url: 'https://www.cookwithmanali.com/wp-content/uploads/2021/07/Tandoori-Roti.jpg' },
      { id: 'item-ind-20', category_id: 'cat-05', name: 'Royal Tandoori Mixed Grill', description: 'Platter of Murgh Tikka, Paneer Tikka, Seeking Kebab & Tandoori Prawns with mint chutney', price: 790.00, is_available: true, image_url: 'https://media-cdn.tripadvisor.com/media/photo-s/1d/2b/f2/96/tandoori-mix-grill.jpg' },

      // --- CONTINENTAL SPECIALS (15 DISHES) ---
      { id: 'item-cont-01', category_id: 'cat-continental', name: 'Dry-Aged Ribeye Steak 12oz', description: 'Rosemary garlic butter, charred asparagus, red wine reduction jus', price: 1280.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-02', category_id: 'cat-continental', name: 'Pan-Seared Atlantic Salmon', description: 'Norwegian salmon fillet over lemon caper butter sauce & wilted spinach', price: 980.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-03', category_id: 'cat-continental', name: 'Fettuccine Alfredo with Chicken', description: 'Handmade fettuccine tossed in rich Parmesan cream sauce & grilled chicken', price: 540.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-04', category_id: 'cat-continental', name: 'Wild Mushroom & Truffle Risotto', description: 'Arborio rice cooked with porcini mushrooms, white truffle oil & shaved Parmesan', price: 640.00, is_available: true, image_url: 'https://www.withspice.com/wp-content/uploads/2023/10/mushroom-risotto.jpg' },
      { id: 'item-cont-05', category_id: 'cat-continental', name: 'Wagyu Beef Sliders (3 pcs)', description: 'Truffle aioli, smoked cheddar, caramelized onion jam on toasted brioche', price: 580.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-06', category_id: 'cat-continental', name: 'Beer-Battered Fish & Chips', description: 'Crispy cod fillet served with skin-on fries, tartar sauce & mushy peas', price: 560.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1579208030886-b937da0925dc?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-07', category_id: 'cat-continental', name: 'Chicken Cordon Bleu', description: 'Breaded chicken breast stuffed with smoked ham & melted Swiss cheese', price: 610.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-08', category_id: 'cat-continental', name: 'Creamy Lobster Bisque', description: 'Smooth velvety soup made with roasted lobster shells, cognac & fresh cream', price: 490.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1594756202469-9ff9799b2e4e?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-09', category_id: 'cat-continental', name: 'Classic Caesar Salad Bowl', description: 'Crisp romaine heart, garlic herb croutons, shaved Parmesan & Caesar dressing', price: 380.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-10', category_id: 'cat-continental', name: 'French Onion Soup Gratinée', description: 'Rich caramelized onion broth topped with crusty baguette & melted Gruyère', price: 340.00, is_available: true, image_url: 'https://www.cookingclassy.com/wp-content/uploads/2022/02/french-onion-soup-28.jpg' },
      { id: 'item-cont-11', category_id: 'cat-continental', name: 'Traditional Shepherd\'s Pie', description: 'Minced lamb & root vegetables baked beneath creamy piped potato crust', price: 590.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-12', category_id: 'cat-continental', name: 'Spaghetti Carbonara Originale', description: 'Egg yolk, Pecorino Romano cheese, crispy guanciale & cracked black pepper', price: 540.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-13', category_id: 'cat-continental', name: 'Pan-Roasted Pork Chops', description: 'Glazed with apple cider honey sauce, served with garlic baby potatoes', price: 680.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-14', category_id: 'cat-continental', name: 'Fresh Caprese Salad Bowl', description: 'Buffalo mozzarella, heirloom tomatoes, fresh basil pesto & aged balsamic glaze', price: 360.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19655?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-cont-15', category_id: 'cat-continental', name: 'Herb Butter Roasted Chicken', description: 'Half roasted chicken with garlic butter, mashed potatoes & grilled greens', price: 560.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80' },

      // --- CHINESE & ASIAN FUSION SPECIALS (15 DISHES) ---
      { id: 'item-chin-01', category_id: 'cat-chinese', name: 'Steamed Truffle Edamame Dim Sum (6 pcs)', description: 'Delicate crystal dumplings filled with edamame mash, water chestnuts & truffle oil', price: 420.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-chin-02', category_id: 'cat-chinese', name: 'Schezwan Hakka Noodles', description: 'Wok-tossed noodles with colorful bell peppers, scallions & fiery Schezwan sauce', price: 340.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-chin-03', category_id: 'cat-chinese', name: 'Chilli Chicken Dry (Indo-Chinese)', description: 'Crispy fried chicken bites tossed with bell peppers, green chilies & soy sauce', price: 450.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-chin-04', category_id: 'cat-chinese', name: 'Vegetable Manchurian Gravy', description: 'Minced vegetable dumplings simmered in savory garlic, ginger & dark soy sauce', price: 360.00, is_available: true, image_url: 'https://kannanskitchen.com/wp-content/uploads/2021/05/IMG_20200927_141911.jpg' },
      { id: 'item-chin-05', category_id: 'cat-chinese', name: 'Yangzhou Special Fried Rice', description: 'Wok-fried jasmine rice with scrambled eggs, sweet corn, green peas & sesame oil', price: 380.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-chin-06', category_id: 'cat-chinese', name: 'Kung Pao Tofu & Peanuts', description: 'Crispy tofu cubes sautéed with Sichuan peppers, dried red chilies & crunchy peanuts', price: 390.00, is_available: true, image_url: 'https://www.noracooks.com/wp-content/uploads/2023/09/kung-pao-tofu-8.jpg' },
      { id: 'item-chin-07', category_id: 'cat-chinese', name: 'Crispy Honey Chilli Potatoes', description: 'Golden fried potato finger chips tossed in sweet chili honey reduction & sesame', price: 290.00, is_available: true, image_url: 'https://i0.wp.com/thetwincookingproject.net/wp-content/uploads/2020/02/Crispy-Honey-Chilli-Potatoes-3-scaled.jpg?fit=1707%2C2560&ssl=1' },
      { id: 'item-chin-08', category_id: 'cat-chinese', name: 'Hot & Sour Chicken Soup', description: 'Classic spicy & sour broth packed with chicken, bamboo shoots & mushrooms', price: 240.00, is_available: true, image_url: 'https://www.chilitochoc.com/wp-content/uploads/2021/01/chinese-hot-and-sour-soup-sq.jpg' },
      { id: 'item-chin-09', category_id: 'cat-chinese', name: 'Crispy Veg Spring Rolls (4 pcs)', description: 'Golden pastry rolls filled with glass noodles & shredded vegetables with chili dip', price: 280.00, is_available: true, image_url: 'https://herbsandflour.com/wp-content/uploads/2023/10/Crispy-Vegetable-Spring-Rolls-Recipe.jpg' },
      { id: 'item-chin-10', category_id: 'cat-chinese', name: 'General Tso\'s Crispy Chicken', description: 'Deep-fried chicken chunks coated in sweet, tangy & garlic chili glaze', price: 480.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-chin-11', category_id: 'cat-chinese', name: 'Sweet & Sour Pork Ribs', description: 'Slow-cooked pork ribs tossed in pineapple, bell pepper & plum sweet-sour reduction', price: 590.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-chin-12', category_id: 'cat-chinese', name: 'Himalayan Chicken Momos (6 pcs)', description: 'Steamed chicken dumplings served with fiery garlic tomato sesame sauce', price: 260.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-chin-13', category_id: 'cat-chinese', name: 'Crispy Peking Duck Pancakes', description: 'Roasted duck slices served with thin steamed pancakes, scallions & Hoisin sauce', price: 790.00, is_available: true, image_url: 'https://thewoksoflife.com/wp-content/uploads/2015/11/peking-duck-recipe-11-1.jpg' },
      { id: 'item-chin-14', category_id: 'cat-chinese', name: 'Sichuan Salt & Pepper Calamari', description: 'Crispy squid rings tossed with crushed Sichuan peppercorns & garlic', price: 440.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-chin-15', category_id: 'cat-chinese', name: 'Classic Chicken Fried Rice', description: 'Wok-tossed long-grain rice with diced chicken, eggs & light soy sauce', price: 360.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80' },

      // --- STARTERS & APPETIZERS ---
      { id: 'item-ind-06', category_id: 'cat-01', name: 'Tandoori Paneer Tikka', description: 'Charcoal-grilled cottage cheese skewers marinated in spiced yogurt & mustard oil', price: 320.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-ind-07', category_id: 'cat-01', name: 'Crispy Samosa Chaat', description: 'Crushed spiced potato samosas topped with chickpeas, tangy tamarind & mint chutney', price: 180.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-app-01', category_id: 'cat-01', name: 'Tomato Basil Bruschetta', description: 'Toasted garlic crostini topped with diced vine tomatoes, basil & extra virgin olive oil', price: 290.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-app-02', category_id: 'cat-01', name: 'Jalapeño Cheese Poppers', description: 'Golden fried breaded jalapeños stuffed with cream cheese & cheddar', price: 270.00, is_available: true, image_url: 'https://www.allrecipes.com/thmb/u2jle7sEiO5vkLrIGar0TakjY8s=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/20858-best-ever-jalapeno-poppers-DDMFS-4x3-69772a3d60cd4a63b6dfac0ff415db51.jpg' },

      // --- DRINKS & BEVERAGES ---
      { id: 'item-ind-08', category_id: 'cat-03', name: 'Mango Lassi Alphonso', description: 'Chilled creamy yogurt smoothie blended with Alphonso mango pulp & cardamom', price: 140.00, is_available: true, image_url: 'https://www.cookclickndevour.com/wp-content/uploads/2016/05/mango-lassi-recipe-c.jpg' },
      { id: 'item-drk-01', category_id: 'cat-03', name: 'Masala Cutting Chai', description: 'Traditional brewed Indian milk tea with ginger, cardamom, cloves & lemongrass', price: 80.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-drk-02', category_id: 'cat-03', name: 'Smoked Old Fashioned', description: 'Bourbon whiskey, aromatic bitters, orange peel & cherry smoke', price: 450.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-drk-03', category_id: 'cat-03', name: 'Fresh Mint Lime Mojito', description: 'Muddled fresh mint, lime juice, sparkling soda & brown sugar syrup', price: 210.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80' },

      // --- DESSERTS & SWEETS ---
      { id: 'item-ind-09', category_id: 'cat-04', name: 'Gulab Jamun with Kesar', description: 'Warm soft milk dumplings soaked in rosewater, cardamom & saffron syrup', price: 160.00, is_available: true, image_url: 'https://www.cookclickndevour.com/wp-content/uploads/2017/08/gulab-jamun-recipe-b.jpg' },
      { id: 'item-des-01', category_id: 'cat-04', name: 'Classic Italian Tiramisu', description: 'Espresso-soaked ladyfingers layered with mascarpone cream & dusted cocoa', price: 340.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80' },
      { id: 'item-des-02', category_id: 'cat-04', name: 'Royal Saffron Rasmalai (2 pcs)', description: 'Soft cottage cheese patties soaked in chilled saffron milk with pistachios', price: 180.00, is_available: true, image_url: 'https://www.shutterstock.com/image-photo/rashmalai-delicate-spongy-rasmalai-soft-260nw-2684524025.jpg' },
      { id: 'item-des-03', category_id: 'cat-04', name: 'Molten Lava Chocolate Cake', description: 'Warm Belgian chocolate cake with gooey liquid center & vanilla bean ice cream', price: 280.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80' }
    ];

    const defaultInventory = [
      { id: 'inv-01', name: 'Wagyu Beef Patties', quantity: 15, unit: 'kg', threshold: 10, supplier: 'Prime Meats Co.' },
      { id: 'inv-02', name: 'Truffle Aioli & Oil', quantity: 4.5, unit: 'Liters', threshold: 3.0, supplier: 'Artisanal Imports' },
      { id: 'inv-03', name: 'Dry-Aged Ribeye', quantity: 18, unit: 'kg', threshold: 8, supplier: 'Prime Meats Co.' },
      { id: 'inv-04', name: 'Bourbon Whiskey & Spirits', quantity: 24, unit: 'Bottles', threshold: 5, supplier: 'Heritage Spirits' },
      { id: 'inv-05', name: 'Fresh Chicken & Poultry', quantity: 45, unit: 'kg', threshold: 12, supplier: 'Royal Poultry Co.' },
      { id: 'inv-06', name: 'Fresh Paneer (Cottage Cheese)', quantity: 30, unit: 'kg', threshold: 10, supplier: 'Desi Dairy Farm' },
      { id: 'inv-07', name: 'Basmati Rice (Long Grain)', quantity: 60, unit: 'kg', threshold: 15, supplier: 'Indus Grains' },
      { id: 'inv-08', name: 'Mango Pulp & Dairy Cream', quantity: 25, unit: 'Liters', threshold: 6, supplier: 'Fresh Harvest' },
      { id: 'inv-09', name: 'Hakka & Ramen Noodle Packs', quantity: 40, unit: 'kg', threshold: 10, supplier: 'Dragon Orient Traders' },
      { id: 'inv-10', name: 'Sichuan Peppers & Soy Sauce', quantity: 18, unit: 'Liters', threshold: 5, supplier: 'Dragon Orient Traders' }
    ];

    // Ensure Categories & Menu Items stay updated with expanded 50+ item menu
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(defaultCategories));
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(defaultMenuItems));

    if (!localStorage.getItem(STORAGE_KEYS.INVENTORY)) {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(defaultInventory));
    } else {
      const currentInv = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY) || '[]');
      if (currentInv.length < 8) {
        localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(defaultInventory));
      }
    }

    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.SESSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.QUEUE)) {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify([]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.TABLES)) {
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(this.generateDefaultTables()));
    }
  }

  // Generalized table seeding: works for any restaurant, any table count.
  // Every table starts AVAILABLE (vacant) -- no hardcoded demo occupancy.
  // Mirrors src/db/seed_tables.sql so local mode and real backend mode
  // produce the same starting state.
  generateDefaultTables(count = 10, defaultCapacity = 4) {
    const tables = [];
    for (let i = 1; i <= count; i++) {
      tables.push({
        id: `tbl-${String(i).padStart(2, '0')}`,
        table_number: `Table ${String(i).padStart(2, '0')}`,
        capacity: defaultCapacity,
        status: 'AVAILABLE',
        section: 'Main Hall'
      });
    }
    return tables;
  }

  // --- MENU CRUD ---
  getMenu() {
    return {
      categories: JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]'),
      items: JSON.parse(localStorage.getItem(STORAGE_KEYS.MENU) || '[]')
    };
  }

  addMenuItem(itemData) {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEYS.MENU) || '[]');
    const newItem = {
      id: `item-${Date.now()}`,
      is_available: true,
      image_url: itemData.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      ...itemData
    };
    items.push(newItem);
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(items));
    return newItem;
  }

  deleteMenuItem(itemId) {
    let items = JSON.parse(localStorage.getItem(STORAGE_KEYS.MENU) || '[]');
    items = items.filter(i => i.id !== itemId);
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(items));
  }

  toggleItemAvailability(itemId) {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEYS.MENU) || '[]');
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.is_available = !item.is_available;
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(items));
    }
    return item;
  }

  // --- INVENTORY CRUD ---
  getInventory() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY) || '[]');
  }

  addIngredient(ingredientData) {
    const inventory = this.getInventory();
    const newIngredient = {
      id: `inv-${Date.now()}`,
      ...ingredientData
    };
    inventory.push(newIngredient);
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
    return newIngredient;
  }

  updateStockQuantity(id, delta) {
    const inventory = this.getInventory();
    const item = inventory.find(i => i.id === id);
    if (item) {
      item.quantity = Math.max(0, parseFloat((item.quantity + delta).toFixed(2)));
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
    }
    return item;
  }

  // --- ORDERS & KITCHEN KDS ---
  getOrders() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
  }

  createOrder(orderData) {
    const orders = this.getOrders();
    const newOrder = {
      id: `ord-${Date.now()}`,
      order_number: `ORD-#${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'NEW',
      created_at: new Date().toISOString(),
      ...orderData
    };
    orders.unshift(newOrder);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Deduct stock for order items dynamically
    this.deductInventoryForOrder(orderData.items);

    // Broadcast across cloud channel to all devices
    this.broadcastOrderSync(newOrder);

    return newOrder;
  }

  updateOrderStatus(orderId, newStatus) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = newStatus;
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

      // Sync Table Status with Order Progression
      if (order.table_id) {
        if (newStatus === 'PREPARING' || newStatus === 'NEW') {
          this.updateTableStatus(order.table_id, 'OCCUPIED');
        } else if (newStatus === 'READY') {
          this.updateTableStatus(order.table_id, 'PAYMENT PENDING');
        } else if (newStatus === 'PAID') {
          this.updateTableStatus(order.table_id, 'AVAILABLE');
        }
      }

      // Broadcast across cloud channel to all devices
      this.broadcastOrderSync(order);
    }
    return order;
  }

  getUnpaidOrders() {
    return this.getOrders().filter(o => o.status !== 'PAID' && o.status !== 'CANCELLED');
  }

  getOrderById(orderId) {
    return this.getOrders().find(o => o.id === orderId) || null;
  }

  markOrderPaid(orderId) {
    const order = this.updateOrderStatus(orderId, 'PAID');
    if (order && order.table_id) {
      this.updateTableStatus(order.table_id, 'CLEANING');
    }
    return order;
  }

  deductInventoryForOrder(items) {
    if (!items || !Array.isArray(items)) return;
    const inventory = this.getInventory();

    items.forEach(item => {
      const nameText = `${item.name || ''} ${item.description || ''}`.toLowerCase();
      
      inventory.forEach(inv => {
        const keywords = inv.name.toLowerCase().split(/\s+/).filter(k => k.length >= 4);
        const isMatch = keywords.some(keyword => nameText.includes(keyword));
        
        if (isMatch) {
          const qtyToDeduct = 0.5 * (item.quantity || 1);
          inv.quantity = Math.max(0, parseFloat((inv.quantity - qtyToDeduct).toFixed(2)));
        }
      });
    });

    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  }

  // --- VIRTUAL QUEUE CRUD ---
  getQueue() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE) || '[]');
  }

  joinQueue(customerData) {
    const queue = this.getQueue();
    const newEntry = {
      id: `q-${Date.now()}`,
      status: 'WAITING',
      joined_at: new Date().toISOString(),
      ...customerData
    };
    queue.push(newEntry);
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    return newEntry;
  }

  removeFromQueue(id) {
    let queue = this.getQueue();
    queue = queue.filter(q => q.id !== id);
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
  }

  getQueuePosition(entryId) {
    const queue = this.getQueue().filter(q => q.status === 'WAITING');
    const idx = queue.findIndex(q => q.id === entryId);
    return idx === -1 ? null : idx + 1;
  }

  // --- TABLES ---
  getTables() {
    const cached = localStorage.getItem(STORAGE_KEYS.TABLES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 10) return parsed;
    }
    const default10Tables = [
      { id: 'tbl-01', table_number: 'Table 01', seats: 2, section: 'Patio', status: 'AVAILABLE' },
      { id: 'tbl-02', table_number: 'Table 02', seats: 4, section: 'Main Hall', status: 'AVAILABLE' },
      { id: 'tbl-03', table_number: 'Table 03', seats: 4, section: 'Main Hall', status: 'AVAILABLE' },
      { id: 'tbl-04', table_number: 'Table 04', seats: 6, section: 'VIP Booth', status: 'AVAILABLE' },
      { id: 'tbl-05', table_number: 'Table 05', seats: 2, section: 'Patio', status: 'AVAILABLE' },
      { id: 'tbl-06', table_number: 'Table 06', seats: 8, section: 'Main Hall', status: 'AVAILABLE' },
      { id: 'tbl-07', table_number: 'Table 07', seats: 2, section: 'Terrace', status: 'AVAILABLE' },
      { id: 'tbl-08', table_number: 'Table 08', seats: 4, section: 'Main Hall', status: 'AVAILABLE' },
      { id: 'tbl-09', table_number: 'Table 09', seats: 6, section: 'VIP Booth', status: 'AVAILABLE' },
      { id: 'tbl-10', table_number: 'Table 10', seats: 8, section: 'Terrace', status: 'AVAILABLE' }
    ];
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(default10Tables));
    return default10Tables;
  }

  updateTableStatus(tableId, status) {
    const tables = this.getTables();
    const table = tables.find(t => t.id === tableId || t.table_number === tableId);
    if (table) {
      table.status = status;
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    }
    return table;
  }

  // --- PAYMENTS ---
  logPaymentAttempt(success) {
    const payments = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]');
    payments.push({ success, at: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  }

  getPaymentStats() {
    const payments = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]');
    if (payments.length === 0) return { attempts: 0, approvalRate: 100 };
    const successCount = payments.filter(p => p.success).length;
    return {
      attempts: payments.length,
      approvalRate: parseFloat(((successCount / payments.length) * 100).toFixed(1))
    };
  }

  // --- LIVE ANALYTICS ---
  getAnalyticsSummary() {
    const orders = this.getOrders().filter(o => o.status !== 'CANCELLED');
    const { categories, items } = this.getMenu();
    const orderCount = orders.length;
    const grossRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const avgCheck = orderCount > 0 ? grossRevenue / orderCount : 0;

    const revenueByCategory = {};
    orders.forEach(order => {
      (order.items || []).forEach(line => {
        const menuItem = items.find(i => i.id === line.id || i.name === line.name);
        const catId = menuItem ? menuItem.category_id : null;
        const cat = categories.find(c => c.id === catId);
        const catName = cat ? cat.name : 'Uncategorized';
        revenueByCategory[catName] = (revenueByCategory[catName] || 0) + (line.price * line.quantity);
      });
    });

    let topCategory = categories[0] ? categories[0].name : 'Menu';
    let topCategoryRevenue = 0;
    Object.entries(revenueByCategory).forEach(([name, revenue]) => {
      if (revenue > topCategoryRevenue) {
        topCategory = name;
        topCategoryRevenue = revenue;
      }
    });

    return {
      grossRevenue: parseFloat(grossRevenue.toFixed(2)),
      orderCount,
      avgCheck: parseFloat(avgCheck.toFixed(2)),
      topCategory,
      approvalRate: this.getPaymentStats().approvalRate
    };
  }

  // Reset all analytics, order history, table sessions, and revenue metrics (Manager feature)
  resetAllAnalytics() {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
    localStorage.removeItem(STORAGE_KEYS.QUEUE);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.TABLE_VACANCY);
    localStorage.removeItem('rest_os_active_session');

    // Reset table statuses back to AVAILABLE
    const tables = this.getTables();
    tables.forEach(tbl => {
      tbl.status = 'AVAILABLE';
      tbl.vacant = 'Y';
    });
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));

    // Broadcast reset event over cloud realtime channel
    this.broadcastOrderSync({ id: 'reset-' + Date.now(), status: 'RESET', order_number: 'RESET', items: [] });
    this.broadcastSessionSync({ session_id: 'reset-' + Date.now(), status: 'RESET' });

    try { window.dispatchEvent(new Event('storage')); } catch (e) {}

    return {
      ok: true,
      message: 'All analytics, order history, sessions, and revenue metrics reset.'
    };
  }

  // =========================================================================
  // REAL SESSION ENGINE & 3-TABLE DATABASE MANAGEMENT (VibeAthon Specs)
  // =========================================================================

  // Helper: 6-Digit Session ID Generator
  generateSessionId() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // --- STAFF PRESENCE (Multi-device simulation) ---
  registerStaffPresence(userId, userName, role) {
    const presence = JSON.parse(localStorage.getItem('rest_os_staff_presence') || '[]');
    const existing = presence.find(p => p.id === userId);
    if (existing) {
      existing.lastActive = Date.now();
      existing.role = role;
    } else {
      presence.push({ id: userId, name: userName, role, lastActive: Date.now(), assignedTables: [] });
    }
    localStorage.setItem('rest_os_staff_presence', JSON.stringify(presence));

    // Auto-assign any waiting sessions and orders to this waiter
    if (role === 'Waiter') {
      const sessions = this.getSessions();
      let updatedSess = false;
      sessions.forEach(s => {
        if (!s.waiter_id && s.status === 'ACTIVE') {
          s.waiter_id = userId;
          updatedSess = true;
        }
      });
      if (updatedSess) {
        this.saveSessions(sessions);
      }

      const orders = this.getOrders();
      let updatedOrders = false;
      orders.forEach(o => {
        if (!o.waiter_id) {
          const matchingSess = sessions.find(s => s.session_id === o.session_id);
          if (matchingSess && matchingSess.waiter_id) {
            o.waiter_id = matchingSess.waiter_id;
            updatedOrders = true;
          } else {
            o.waiter_id = userId;
            updatedOrders = true;
          }
        }
      });
      if (updatedOrders) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      }
      if (updatedSess || updatedOrders) {
        window.dispatchEvent(new Event('storage'));
      }
    }
    
    // Auto-assign unassigned kitchen orders to this chef
    if (role === 'Kitchen') {
      const orders = this.getOrders();
      let updated = false;
      orders.forEach(o => {
        if (!o.chef_id && (o.status === 'NEW' || o.status === 'ACCEPTED' || o.status === 'SENT_TO_KITCHEN' || o.status === 'PREPARING')) {
          o.chef_id = userId;
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
        window.dispatchEvent(new Event('storage'));
      }
    }
  }

  getAvailableStaff(role) {
    const presence = JSON.parse(localStorage.getItem('rest_os_staff_presence') || '[]');
    // Clean up stale sessions (older than 15 minutes)
    const active = presence.filter(p => (Date.now() - p.lastActive) < 15 * 60 * 1000);
    localStorage.setItem('rest_os_staff_presence', JSON.stringify(active));
    return active.filter(p => p.role === role);
  }

  // Helper: Waiter Allotment
  allotWaiter() {
    const waiters = this.getAvailableStaff('Waiter');
    if (waiters.length === 0) return null; // None logged in
    
    // Sort by least assigned tables
    waiters.sort((a, b) => (a.assignedTables?.length || 0) - (b.assignedTables?.length || 0));
    return waiters[0].id;
  }
  
  allotKitchen() {
    const kitchen = this.getAvailableStaff('Kitchen');
    if (kitchen.length === 0) return null; // None logged in
    return kitchen[0].id;
  }

  // --- SESSIONS ---
  getSessions() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]');
  }

  saveSessions(sessions) {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    try { window.dispatchEvent(new Event('storage')); } catch(e){}
  }

  getActiveSessionForCustomer(customerId) {
    const sessions = this.getSessions();
    return sessions.find(s => (s.customer_id === customerId || s.customer_email === customerId) && s.status === 'ACTIVE') || null;
  }

  getSessionById(sessionId) {
    return this.getSessions().find(s => s.session_id === String(sessionId)) || null;
  }

  // Table Booking & Session Generation Flow
  startSession(customerId, customerName = 'Guest', preferredTable = null) {
    const tables = this.getTables();
    const availableTables = tables.filter(t => t.status === 'AVAILABLE' || t.status === 'CLEANING');

    if (availableTables.length === 0) {
      return {
        ok: false,
        reason: 'FULL',
        message: 'Sorry Restaurant FULL! All tables are currently occupied.'
      };
    }

    const targetDigit = preferredTable ? String(preferredTable).replace(/\D/g, '') : null;
    let allottedTable = null;

    if (preferredTable && targetDigit) {
      allottedTable = tables.find(t => t.table_number.replace(/\D/g, '') === targetDigit && (t.status === 'AVAILABLE' || t.status === 'CLEANING'));
      if (!allottedTable) {
        allottedTable = tables.find(t => t.table_number.replace(/\D/g, '') === targetDigit);
      }
    }
    if (!allottedTable) {
      allottedTable = availableTables[0];
    }

    const sessionId = this.generateSessionId(); // 6-digit numeric session ID
    const waiterId = this.allotWaiter();
    const todayStr = new Date().toISOString().split('T')[0];
    const startTimeStr = new Date().toLocaleTimeString();

    const newSession = {
      id: `sess-${Date.now()}`,
      date: todayStr,
      session_id: sessionId,
      session_start_time: startTimeStr,
      session_end_time: null,
      customer_id: customerId || `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_name: customerName,
      customer_email: customerId.includes('@') ? customerId : `${customerId}@guest.com`,
      table_no: allottedTable.table_number || allottedTable.id,
      waiter_id: waiterId,
      order_ids: [],
      total_order_amount: 0,
      total_session_amount: 0,
      status: 'ACTIVE',
      delivered: 'N',
      estimated_wait_minutes: 15,
      payment_type: null,
      created_at: new Date().toISOString()
    };

    const sessions = this.getSessions();
    sessions.unshift(newSession);
    this.saveSessions(sessions);

    // Update Table status to OCCUPIED / Vacant = N
    this.updateTableStatus(allottedTable.id, 'OCCUPIED');
    
    // Broadcast cloud sync across all devices
    this.broadcastSessionSync(newSession);
    try { window.dispatchEvent(new Event('storage')); } catch(e){}

    return {
      ok: true,
      session: newSession,
      message: `Table ${allottedTable.table_number} booked successfully! Session ID: ${sessionId}, Waiter Allotted: ${waiterId || 'Waiting for Waiter'}`
    };
  }

  // Session Order Creation Flow
  createSessionOrder(sessionId, items, specialInstructions = '') {
    const session = this.getSessionById(sessionId);
    if (!session) return { ok: false, message: 'Active session not found.' };

    const orderNo = `ORD-#${Math.floor(1000 + Math.random() * 9000)}`;
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price || 0) * (item.quantity || 1)), 0);
    const gstRate = 0.05; // 5% GST
    const serviceRate = 0.05; // 5% Service Charge
    const tax = subtotal * (gstRate + serviceRate);
    const total = subtotal + tax;

    const orderData = {
      id: `ord-${Date.now()}`,
      order_number: orderNo,
      session_id: session.session_id,
      table_id: session.table_no,
      waiter_id: session.waiter_id,
      customer_id: session.customer_id,
      customer_name: session.customer_name,
      status: 'NEW',
      delivered: 'N', // Initial delivered column = N
      special_instructions: specialInstructions,
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      estimated_wait_minutes: 15,
      created_at: new Date().toISOString()
    };

    // Save Order
    const orders = this.getOrders();
    orders.unshift(orderData);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Deduct stock
    this.deductInventoryForOrder(items);

    // Update Session aggregates
    session.order_ids.push(orderNo);
    session.total_order_amount = parseFloat((session.total_order_amount + subtotal).toFixed(2));
    session.total_session_amount = parseFloat((session.total_session_amount + total).toFixed(2));
    session.delivered = 'N';

    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.session_id === session.session_id);
    if (idx !== -1) sessions[idx] = session;
    this.saveSessions(sessions);

    // Broadcast cloud sync across all devices
    this.broadcastOrderSync(orderData);
    this.broadcastSessionSync(session);
    try { window.dispatchEvent(new Event('storage')); } catch(e){}

    return {
      ok: true,
      order: orderData,
      session,
      message: `Order ${orderNo} confirmed! Server estimated prep time: 15 minutes.`
    };
  }

  // Server/Waiter Served Confirmation Flow
  // Post serving -> Served confirmation to server side -> updates Delivered (Y/N) column in DB from N to Y
  markOrderServed(orderId) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId || o.order_number === orderId);
    if (!order) return { ok: false, message: 'Order not found.' };

    order.delivered = 'Y';
    order.status = 'PAYMENT_PENDING';
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Update parent session delivered status
    if (order.session_id) {
      const session = this.getSessionById(order.session_id);
      if (session) {
        session.delivered = 'Y';
        const sessions = this.getSessions();
        const idx = sessions.findIndex(s => s.session_id === session.session_id);
        if (idx !== -1) sessions[idx] = session;
        this.saveSessions(sessions);
        this.broadcastSessionSync(session);
      }
    }

    this.broadcastOrderSync(order);

    return { ok: true, order, message: `Order ${order.order_number} marked as SERVED! DB updated Delivered = Y.` };
  }

  // Session Termination & Bill Receipt Flow
  terminateSession(sessionId, paymentType = 'UPI', feedbackObj = null) {
    const session = this.getSessionById(sessionId);
    if (!session) return { ok: false, message: 'Session not found.' };

    session.session_end_time = new Date().toLocaleTimeString();
    session.status = 'TERMINATED';
    session.payment_type = paymentType;

    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.session_id === session.session_id);
    if (idx !== -1) sessions[idx] = session;
    this.saveSessions(sessions);

    // Mark Table Number as Vacant (AVAILABLE)
    this.updateTableStatus(session.table_no, 'AVAILABLE');

    // Mark orders for this session as PAID so active waiter and kitchen tickets vanish
    const orders = this.getOrders();
    let updatedOrders = false;
    orders.forEach(o => {
      if (o.session_id === session.session_id) {
        o.status = 'PAID';
        o.delivered = 'Y';
        updatedOrders = true;
      }
    });
    if (updatedOrders) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    }
    try { window.dispatchEvent(new Event('storage')); } catch(e){}

    // Extract 1-word general feedback from feedback popup (e.g. sentiment emoji or text)
    let oneWordFeedback = 'Excellent';
    if (feedbackObj) {
      if (typeof feedbackObj === 'string') {
        oneWordFeedback = feedbackObj.trim().split(/\s+/)[0] || 'Good';
      } else if (feedbackObj.rating) {
        const ratingMap = { 5: 'Excellent', 4: 'Good', 3: 'Average', 2: 'Poor', 1: 'Terrible' };
        oneWordFeedback = ratingMap[feedbackObj.rating] || 'Good';
      }
      if (feedbackObj.reviewText) {
        const words = feedbackObj.reviewText.trim().split(/\s+/);
        if (words.length > 0 && words[0].length >= 3) {
          oneWordFeedback = words[0].replace(/[^a-zA-Z]/g, '');
          oneWordFeedback = oneWordFeedback.charAt(0).toUpperCase() + oneWordFeedback.slice(1);
        }
      }
    }

    // Update Customer History database with final session bill and 1-word feedback
    this.updateCustomerHistoryPostPayment(session.customer_id, session.total_session_amount, oneWordFeedback);
    this.logPaymentAttempt(true);

    const formattedBill = this.generateFormattedBillReceipt(session, paymentType);

    return {
      ok: true,
      session,
      receiptText: formattedBill,
      message: `Session ${session.session_id} terminated. Table ${session.table_no} marked as Vacant.`
    };
  }

  // Reorder in Same Session Flow
  reorderInSession(sessionId) {
    const session = this.getSessionById(sessionId);
    if (!session) return { ok: false, message: 'Session not found.' };
    return { ok: true, session, message: `Reorder initiated for Session ID ${session.session_id}.` };
  }

  // --- CUSTOMER HISTORY DATABASE ---
  getCustomerHistory() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMER_HISTORY) || '[]');
  }

  clearActiveSession(customerId) {
    const sessions = this.getSessions();
    const session = sessions.find(s => (s.customer_id === customerId || s.customer_email === customerId || !customerId) && s.status === 'ACTIVE');
    if (session) {
      session.status = 'TERMINATED';
      session.session_end_time = new Date().toLocaleTimeString();
      this.updateTableStatus(session.table_no, 'AVAILABLE');
      this.saveSessions(sessions);

      // Mark orders for this session as TERMINATED so active waiter and kitchen tickets vanish
      const orders = this.getOrders();
      let updatedOrders = false;
      orders.forEach(o => {
        if (o.session_id === session.session_id) {
          o.status = 'TERMINATED';
          updatedOrders = true;
        }
      });
      if (updatedOrders) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      }
      try { window.dispatchEvent(new Event('storage')); } catch(e){}
    }
    localStorage.removeItem('rest_os_active_session');
  }

  saveCustomerHistory(history) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_HISTORY, JSON.stringify(history));
  }

  recordCustomerVisit(customerId, visitDate) {
    const history = this.getCustomerHistory();
    let customer = history.find(c => c.customer_id === customerId);

    if (!customer) {
      customer = {
        customer_id: customerId,
        dates_visited: [visitDate],
        bill_per_visit: [],
        total_bill: 0,
        visit_count: 1,
        general_one_word_feedback: 'Pending'
      };
      history.push(customer);
    } else {
      if (!customer.dates_visited.includes(visitDate)) {
        customer.dates_visited.push(visitDate);
      }
      customer.visit_count += 1;
    }

    this.saveCustomerHistory(history);
  }

  updateCustomerHistoryPostPayment(customerId, billAmount, oneWordFeedback) {
    const history = this.getCustomerHistory();
    let customer = history.find(c => c.customer_id === customerId);

    if (!customer) {
      customer = {
        customer_id: customerId,
        dates_visited: [new Date().toISOString().split('T')[0]],
        bill_per_visit: [billAmount],
        total_bill: billAmount,
        visit_count: 1,
        general_one_word_feedback: oneWordFeedback
      };
      history.push(customer);
    } else {
      customer.bill_per_visit.push(billAmount);
      customer.total_bill = parseFloat((customer.total_bill + billAmount).toFixed(2));
      customer.general_one_word_feedback = oneWordFeedback;
    }

    this.saveCustomerHistory(history);
  }

  // --- BILL RECEIPT GENERATOR (Exact Spec Format) ---
  generateFormattedBillReceipt(session, paymentType = 'UPI') {
    const orders = this.getOrders().filter(o => session.order_ids.includes(o.order_number) || o.session_id === session.session_id);
    const dateStr = session.date || new Date().toISOString().split('T')[0];
    const timeStr = session.session_start_time || new Date().toLocaleTimeString();
    const orderListStr = session.order_ids.join(', ') || 'ORD-#1042';

    let itemsRowsText = '';
    orders.forEach(ord => {
      (ord.items || []).forEach(item => {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        itemsRowsText += `${ord.order_number} | ${item.name} (${item.quantity}x) | ₹${itemTotal}\n`;
      });
    });

    const subtotal = session.total_order_amount || orders.reduce((s, o) => s + (o.subtotal || 0), 0);
    const gstAndService = (session.total_session_amount - subtotal) || (subtotal * 0.10);
    const totalBill = session.total_session_amount || (subtotal + gstAndService);

    return `
                               RestaurantOS

Date - ${dateStr}
Time - ${timeStr}
Customer ID - ${session.customer_id}
Session ID - ${session.session_id}
Sub Order Id list - ${orderListStr}
Order NO | Amount | GST+Service Charge | Total Session Amount 
__________________________________________________
${itemsRowsText || 'ORD-#1042 | Gourmet Meal | ₹' + subtotal.toFixed(2)}
Subtotal: ₹${subtotal.toFixed(2)}
GST + Service Charge (10%): ₹${gstAndService.toFixed(2)}
__________________________________________________

Total Bill = ₹${totalBill.toFixed(2)}

Payment Options:
1) UPI-(Stripe) [${paymentType === 'UPI' ? 'SELECTED' : 'Available'}]
2) Card         [${paymentType === 'Card' ? 'SELECTED' : 'Available'}]
3) Cash         [${paymentType === 'Cash' ? 'SELECTED' : 'Available'}]
                                            
                                  THANKS FOR VISITING
--------------------------------****------------------------------------
`;
  }

  // =========================================================================
  // 3-TABLE SERVER-SIDE DATA EXPORTER (Main Data, Table Vacancy, Customer History)
  // =========================================================================

  // D-Table Design-1 (Main Data Table)
  // Date | Session ID | Session start time | Session End Time | Customer ID | Table No | Waiter ID (alloted) | Order ID | Total Order Amount | Total Session Amount | Daily Revenue | Weekly Revenue | Monthly Revenue | Quarterly Revenue | Annual Revenue
  getDTableMainData() {
    const sessions = this.getSessions();
    const orders = this.getOrders();
    const todayStr = new Date().toISOString().split('T')[0];

    // Aggregates
    const dailyRevenue = sessions.filter(s => s.date === todayStr).reduce((sum, s) => sum + s.total_session_amount, 0);
    const weeklyRevenue = sessions.reduce((sum, s) => sum + s.total_session_amount, 0); // Active rolling total
    const monthlyRevenue = weeklyRevenue * 4.2;
    const quarterlyRevenue = monthlyRevenue * 3;
    const annualRevenue = quarterlyRevenue * 4;

    if (sessions.length === 0) {
      // Return sample dynamic baseline row
      return [{
        date: todayStr,
        session_id: '849201',
        session_start_time: '12:30:00 PM',
        session_end_time: '01:15:00 PM',
        customer_id: 'CUST-8021',
        table_no: 'Table 02',
        waiter_id: 'WAIT-01 (Rahul S.)',
        order_id: 'ORD-#1042',
        delivered: 'Y',
        total_order_amount: 1460.00,
        total_session_amount: 1584.10,
        daily_revenue: 1584.10,
        weekly_revenue: 11088.70,
        monthly_revenue: 46572.54,
        quarterly_revenue: 139717.62,
        annual_revenue: 558870.48
      }];
    }

    return sessions.map(s => ({
      date: s.date,
      session_id: s.session_id,
      session_start_time: s.session_start_time || '12:00:00 PM',
      session_end_time: s.session_end_time || 'Active',
      customer_id: s.customer_id,
      table_no: s.table_no,
      waiter_id: s.waiter_id,
      order_id: (s.order_ids && s.order_ids.length > 0) ? s.order_ids.join(', ') : 'ORD-#1042',
      delivered: s.delivered || 'Y',
      total_order_amount: s.total_order_amount,
      total_session_amount: s.total_session_amount,
      daily_revenue: parseFloat(dailyRevenue.toFixed(2)),
      weekly_revenue: parseFloat(weeklyRevenue.toFixed(2)),
      monthly_revenue: parseFloat(monthlyRevenue.toFixed(2)),
      quarterly_revenue: parseFloat(quarterlyRevenue.toFixed(2)),
      annual_revenue: parseFloat(annualRevenue.toFixed(2))
    }));
  }

  // D-Table 2 (Table Vacancy)
  // Table No | Vacant (Y/N)
  getDTableVacancy() {
    const tables = this.getTables();
    return tables.map(t => ({
      table_no: t.table_number || t.id,
      vacant: (t.status === 'AVAILABLE' || t.status === 'CLEANING') ? 'Y' : 'N',
      status: t.status
    }));
  }

  // D-Table 3 (Customer History Engine)
  getCustomerHistory() {
    const sessions = this.getSessions();
    const map = {};

    sessions.forEach(s => {
      const cid = s.customer_id || 'CUST-8021';
      const cName = s.customer_name || 'Guest';
      const date = s.date || new Date(s.created_at || Date.now()).toISOString().split('T')[0];
      const bill = parseFloat(s.total_session_amount || s.total_order_amount || 0);
      const feedback = s.feedback?.one_word || s.general_one_word_feedback || 'EXCELLENT';

      if (!map[cid]) {
        map[cid] = {
          customer_id: cid,
          customer_name: cName,
          dates_visited: [date],
          bill_per_visit: [bill],
          total_bill: bill,
          visit_count: 1,
          general_one_word_feedback: feedback
        };
      } else {
        map[cid].dates_visited.push(date);
        map[cid].bill_per_visit.push(bill);
        map[cid].total_bill += bill;
        map[cid].visit_count += 1;
        if (feedback) map[cid].general_one_word_feedback = feedback;
      }
    });

    return Object.values(map);
  }

  // D-Table 3 (Customer History)
  // Customer ID | Dates Visited | Bill per visit | Total Bill | Visit Count | General one word feedback
  getDTableCustomerHistory() {
    const history = this.getCustomerHistory();
    if (history.length === 0) {
      return [{
        customer_id: 'CUST-8021',
        dates_visited: new Date().toISOString().split('T')[0],
        bill_per_visit: '₹1584.10',
        total_bill: 1584.10,
        visit_count: 1,
        general_one_word_feedback: 'EXCELLENT'
      }];
    }

    return history.map(h => ({
      customer_id: h.customer_name && h.customer_name !== 'Guest' ? `${h.customer_name} (${h.customer_id})` : h.customer_id,
      dates_visited: Array.isArray(h.dates_visited) ? Array.from(new Set(h.dates_visited)).join(', ') : h.dates_visited,
      bill_per_visit: Array.isArray(h.bill_per_visit) ? h.bill_per_visit.map(b => `₹${Number(b).toFixed(2)}`).join(', ') : `₹${Number(h.total_bill || 0).toFixed(2)}`,
      total_bill: parseFloat((h.total_bill || 0).toFixed(2)),
      visit_count: h.visit_count || 1,
      general_one_word_feedback: String(h.general_one_word_feedback || 'EXCELLENT').toUpperCase()
    }));
  }
}

export const dbEngine = new DynamicDatabaseEngine();

