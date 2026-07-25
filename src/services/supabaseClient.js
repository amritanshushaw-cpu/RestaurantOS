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
  PAYMENTS: 'rest_os_payments'
};

class DynamicDatabaseEngine {
  constructor() {
    this.initDefaultState();
  }

  // Initialize or load state from localStorage
  initDefaultState() {
    const defaultCategories = [
      { id: 'cat-01', name: 'Starters & Appetizers', display_order: 1 },
      { id: 'cat-02', name: 'Mains & Steaks', display_order: 2 },
      { id: 'cat-05', name: 'Indian Specialties', display_order: 3 },
      { id: 'cat-03', name: 'Drinks & Beverages', display_order: 4 },
      { id: 'cat-04', name: 'Desserts', display_order: 5 }
    ];

    const defaultMenuItems = [
      // Indian Specialties & Mains
      { id: 'item-ind-01', category_id: 'cat-05', name: 'Butter Chicken (Murgh Makhani)', description: 'Tender tandoori chicken simmered in rich creamy tomato butter gravy', price: 480.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500' },
      { id: 'item-ind-02', category_id: 'cat-05', name: 'Paneer Butter Masala', description: 'Soft cottage cheese cubes cooked in rich cashew and spiced tomato gravy', price: 420.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500' },
      { id: 'item-ind-03', category_id: 'cat-05', name: 'Hyderabadi Dum Biryani', description: 'Fragrant long-grain basmati rice layered with spiced chicken, saffron & mint', price: 450.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500' },
      { id: 'item-ind-04', category_id: 'cat-05', name: 'Dal Makhani', description: 'Slow-cooked black lentils simmered overnight with butter & cream', price: 360.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500' },
      { id: 'item-ind-05', category_id: 'cat-05', name: 'Garlic Butter Naan', description: 'Traditional clay oven tandoori bread brushed with fresh garlic butter & cilantro', price: 90.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500' },

      // Indian Starters & Drinks
      { id: 'item-ind-06', category_id: 'cat-01', name: 'Tandoori Paneer Tikka', description: 'Charcoal-grilled cottage cheese skewers marinated in spiced yogurt & mustard oil', price: 320.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500' },
      { id: 'item-ind-07', category_id: 'cat-01', name: 'Crispy Samosa Chaat', description: 'Crushed spiced potato samosas topped with chickpeas, tangy tamarind & mint chutney', price: 180.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500' },
      { id: 'item-ind-08', category_id: 'cat-03', name: 'Mango Lassi', description: 'Chilled creamy yogurt smoothie blended with Alphonso mango pulp & cardamom', price: 140.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500' },
      { id: 'item-ind-09', category_id: 'cat-04', name: 'Gulab Jamun with Kesar', description: 'Warm soft milk dumplings soaked in rosewater, cardamom & saffron syrup', price: 160.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500' },

      // Western Favorites
      { id: 'item-01', category_id: 'cat-01', name: 'Wagyu Beef Sliders', description: 'Truffle aioli, smoked cheddar, brioche bun', price: 580.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500' },
      { id: 'item-02', category_id: 'cat-02', name: 'Dry-Aged Ribeye 12oz', description: 'Rosemary butter, charred asparagus, jus', price: 1280.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500' },
      { id: 'item-03', category_id: 'cat-03', name: 'Smoked Old Fashioned', description: 'Bourbon, aromatic bitters, orange peel', price: 450.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500' }
    ];

    const defaultInventory = [
      { id: 'inv-01', name: 'Wagyu Beef Patties', quantity: 15, unit: 'kg', threshold: 10, supplier: 'Prime Meats Co.' },
      { id: 'inv-02', name: 'Truffle Aioli', quantity: 2.5, unit: 'Liters', threshold: 3.0, supplier: 'Artisanal Imports' },
      { id: 'inv-03', name: 'Dry-Aged Ribeye', quantity: 18, unit: 'kg', threshold: 8, supplier: 'Prime Meats Co.' },
      { id: 'inv-04', name: 'Bourbon Whiskey', quantity: 14, unit: 'Bottles', threshold: 5, supplier: 'Heritage Spirits' },
      { id: 'inv-05', name: 'Chicken Breasts & Thighs', quantity: 20, unit: 'kg', threshold: 8, supplier: 'Royal Poultry Co.' },
      { id: 'inv-06', name: 'Paneer (Cottage Cheese)', quantity: 14, unit: 'kg', threshold: 5, supplier: 'Desi Dairy Farm' },
      { id: 'inv-07', name: 'Basmati Rice', quantity: 30, unit: 'kg', threshold: 10, supplier: 'Indus Grains' },
      { id: 'inv-08', name: 'Mango Pulp & Milk', quantity: 12, unit: 'Liters', threshold: 4, supplier: 'Fresh Harvest' }
    ];

    // Ensure Categories & Menu Items stay updated with Indian Cuisine & INR pricing
    const currentCategories = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
    if (currentCategories.length < 5) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(defaultCategories));
    }

    const currentMenu = JSON.parse(localStorage.getItem(STORAGE_KEYS.MENU) || '[]');
    const hasINR = currentMenu.some(item => item.price > 100);
    if (!hasINR || currentMenu.length < 8) {
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(defaultMenuItems));
    }

    if (!localStorage.getItem(STORAGE_KEYS.INVENTORY)) {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(defaultInventory));
    } else {
      const currentInv = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY) || '[]');
      if (currentInv.length < 6) {
        localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(defaultInventory));
      }
    }

    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      const defaultOrders = [
        {
          id: 'ord-demo-01',
          order_number: 'ORD-#1042',
          table_id: 'Table 02',
          status: 'PREPARING',
          customer_name: 'Alex Mercer',
          special_instructions: 'Medium rare steak, extra truffle aioli on the side. Non-spicy for kids.',
          items: [
            { id: 'item-02', name: 'Dry-Aged Ribeye 12oz', price: 1280.00, quantity: 1 },
            { id: 'item-ind-05', name: 'Garlic Butter Naan', price: 90.00, quantity: 2 }
          ],
          subtotal: 1460.00,
          tax: 124.10,
          total: 1584.10,
          created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
        },
        {
          id: 'ord-demo-02',
          order_number: 'ORD-#1043',
          table_id: 'Table 04',
          status: 'NEW',
          customer_name: 'Elena Rostova',
          special_instructions: 'Gluten-free preference. Extra mint chutney with Samosa Chaat!',
          items: [
            { id: 'item-ind-01', name: 'Butter Chicken (Murgh Makhani)', price: 480.00, quantity: 2 },
            { id: 'item-ind-07', name: 'Crispy Samosa Chaat', price: 180.00, quantity: 1 },
            { id: 'item-ind-08', name: 'Mango Lassi', price: 140.00, quantity: 2 }
          ],
          subtotal: 1420.00,
          tax: 120.70,
          total: 1540.70,
          created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(defaultOrders));
    }



    if (!localStorage.getItem(STORAGE_KEYS.QUEUE)) {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify([
        { id: 'q-01', name: 'Alex Mercer', party_size: 4, status: 'WAITING', joined_at: new Date().toISOString() }
      ]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.TABLES)) {
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify([
        { id: 'tbl-01', table_number: 'Table 01', capacity: 2, status: 'AVAILABLE', section: 'Patio' },
        { id: 'tbl-02', table_number: 'Table 02', capacity: 4, status: 'OCCUPIED', section: 'Main Hall' },
        { id: 'tbl-03', table_number: 'Table 03', capacity: 4, status: 'AVAILABLE', section: 'Main Hall' },
        { id: 'tbl-04', table_number: 'Table 04', capacity: 6, status: 'RESERVED', section: 'VIP' },
        { id: 'tbl-05', table_number: 'Table 05', capacity: 2, status: 'CLEANING', section: 'Patio' },
        { id: 'tbl-06', table_number: 'Table 06', capacity: 8, status: 'AVAILABLE', section: 'Main Hall' }
      ]));
    }
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
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TABLES) || '[]');
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
}

export const dbEngine = new DynamicDatabaseEngine();
