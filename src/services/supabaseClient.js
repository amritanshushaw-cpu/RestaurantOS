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
  TABLES: 'rest_os_tables'
};

class DynamicDatabaseEngine {
  constructor() {
    this.initDefaultState();
  }

  // Initialize or load state from localStorage
  initDefaultState() {
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify([
        { id: 'cat-01', name: 'Starters', display_order: 1 },
        { id: 'cat-02', name: 'Mains & Steaks', display_order: 2 },
        { id: 'cat-03', name: 'Cocktails', display_order: 3 },
        { id: 'cat-04', name: 'Desserts', display_order: 4 }
      ]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.MENU)) {
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify([
        { id: 'item-01', category_id: 'cat-01', name: 'Wagyu Beef Sliders', description: 'Truffle aioli, smoked cheddar', price: 24.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500' },
        { id: 'item-02', category_id: 'cat-02', name: 'Dry-Aged Ribeye 12oz', description: 'Rosemary butter, asparagus', price: 58.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500' },
        { id: 'item-03', category_id: 'cat-03', name: 'Smoked Old Fashioned', description: 'Bourbon, aromatic bitters', price: 16.00, is_available: true, image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500' }
      ]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.INVENTORY)) {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify([
        { id: 'inv-01', name: 'Wagyu Beef Patties', quantity: 15, unit: 'kg', threshold: 10, supplier: 'Prime Meats Co.' },
        { id: 'inv-02', name: 'Truffle Aioli', quantity: 2.5, unit: 'Liters', threshold: 3.0, supplier: 'Artisanal Imports' },
        { id: 'inv-03', name: 'Dry-Aged Ribeye', quantity: 18, unit: 'kg', threshold: 8, supplier: 'Prime Meats Co.' },
        { id: 'inv-04', name: 'Bourbon Whiskey', quantity: 14, unit: 'Bottles', threshold: 5, supplier: 'Heritage Spirits' }
      ]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.QUEUE)) {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify([
        { id: 'q-01', name: 'Alex Mercer', party_size: 4, status: 'WAITING', joined_at: new Date().toISOString() }
      ]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.TABLES)) {
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify([
        { id: 'tbl-01', table_number: 'Table 01', capacity: 2, status: 'AVAILABLE' },
        { id: 'tbl-02', table_number: 'Table 02', capacity: 4, status: 'OCCUPIED' },
        { id: 'tbl-03', table_number: 'Table 03', capacity: 4, status: 'AVAILABLE' },
        { id: 'tbl-04', table_number: 'Table 04', capacity: 6, status: 'RESERVED' }
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
    }
    return order;
  }

  deductInventoryForOrder(items) {
    if (!items || !Array.isArray(items)) return;
    const inventory = this.getInventory();

    items.forEach(item => {
      // Find matching ingredient by name keywords
      const match = inventory.find(inv => item.name && item.name.toLowerCase().includes(inv.name.split(' ')[0].toLowerCase()));
      if (match) {
        match.quantity = Math.max(0, parseFloat((match.quantity - (0.5 * item.quantity)).toFixed(2)));
      }
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

  // --- TABLES ---
  getTables() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TABLES) || '[]');
  }

  updateTableStatus(tableId, status) {
    const tables = this.getTables();
    const table = tables.find(t => t.id === tableId);
    if (table) {
      table.status = status;
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    }
    return table;
  }
}

export const dbEngine = new DynamicDatabaseEngine();
