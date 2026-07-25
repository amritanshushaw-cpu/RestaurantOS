/**
 * RestaurantOS - Supabase Database Client & Sandbox Fallback Engine
 * Provides unified interface for Supabase queries with local memory fallback.
 */

class MockDatabaseStore {
  constructor() {
    this.restaurants = [
      { id: 'res-01', name: 'Hexcore Bistro & Lounge', currency: 'USD', tax_rate: 8.5 }
    ];
    this.tables = [
      { id: 'tbl-01', table_number: 'Table 01', capacity: 2, status: 'AVAILABLE' },
      { id: 'tbl-02', table_number: 'Table 02', capacity: 4, status: 'OCCUPIED' },
      { id: 'tbl-03', table_number: 'Table 03', capacity: 4, status: 'AVAILABLE' },
      { id: 'tbl-04', table_number: 'Table 04', capacity: 6, status: 'RESERVED' },
      { id: 'tbl-05', table_number: 'Table 05', capacity: 2, status: 'CLEANING' },
      { id: 'tbl-06', table_number: 'Table 06', capacity: 8, status: 'AVAILABLE' }
    ];
    this.categories = [
      { id: 'cat-01', name: 'Signature Starters', display_order: 1 },
      { id: 'cat-02', name: 'Mains & Steaks', display_order: 2 },
      { id: 'cat-03', name: 'Artisanal Cocktails', display_order: 3 },
      { id: 'cat-04', name: 'Decadent Desserts', display_order: 4 }
    ];
    this.menuItems = [
      { id: 'item-01', category_id: 'cat-01', name: 'Wagyu Beef Sliders', description: 'Truffle aioli, smoked cheddar, brioche bun', price: 24.00, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500' },
      { id: 'item-02', category_id: 'cat-01', name: 'Crispy Calamari', description: 'Yuzu lemon dip, toasted garlic, parsley', price: 18.00, image_url: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500' },
      { id: 'item-03', category_id: 'cat-02', name: 'Dry-Aged Ribeye 12oz', description: 'Rosemary butter, charred asparagus, red wine jus', price: 58.00, image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500' },
      { id: 'item-04', category_id: 'cat-02', name: 'Truffle Mushroom Risotto', description: 'Arborio rice, aged parmesan, wild forest mushrooms', price: 32.00, image_url: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=500' },
      { id: 'item-05', category_id: 'cat-03', name: 'Smoked Old Fashioned', description: 'Bourbon, aromatic bitters, charred orange peel', price: 16.00, image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500' },
      { id: 'item-06', category_id: 'cat-04', name: 'Molten Chocolate Lava Cake', description: 'Tahitian vanilla bean gelato, raspberry reduction', price: 14.00, image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500' }
    ];
    this.orders = [];
    this.payments = [];
  }
}

class SupabaseClientWrapper {
  constructor() {
    this.url = typeof process !== 'undefined' && process.env?.SUPABASE_URL || null;
    this.key = typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY || null;
    this.store = new MockDatabaseStore();
    this.isLive = false;
  }

  // Get Menu Data
  async getMenu() {
    return {
      categories: this.store.categories,
      items: this.store.menuItems
    };
  }

  // Get Dining Tables
  async getTables() {
    return this.store.tables;
  }

  // Update Table Status
  async updateTableStatus(tableId, status) {
    const table = this.store.tables.find(t => t.id === tableId);
    if (table) {
      table.status = status;
      return { success: true, table };
    }
    return { success: false, error: 'Table not found' };
  }

  // Create Order
  async createOrder(orderPayload) {
    const newOrder = {
      id: `ord-${Date.now()}`,
      order_number: `ORD-#${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'NEW',
      created_at: new Date().toISOString(),
      ...orderPayload
    };
    this.store.orders.unshift(newOrder);
    return { success: true, order: newOrder };
  }

  // Fetch Active Kitchen Orders
  async getKitchenOrders() {
    return this.store.orders.filter(o => o.status !== 'PAID' && o.status !== 'CANCELLED');
  }
}

export const dbClient = new SupabaseClientWrapper();
