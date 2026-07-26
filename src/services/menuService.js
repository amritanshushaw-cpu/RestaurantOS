/**
 * RestaurantOS - Menu Service Layer (Dynamic)
 * Connects to DynamicDatabaseEngine for real CRUD operations.
 */

import { dbEngine } from './supabaseClient.js';

export class MenuService {
  // Load Menu Data Dynamically
  loadMenu() {
    return dbEngine.getMenu();
  }

  // Get Items Filtered by Category
  getItemsByCategory(categoryId) {
    const data = this.loadMenu();
    if (!categoryId || categoryId === 'ALL') {
      return data.items;
    }
    return data.items.filter(i => i.category_id === categoryId);
  }

  // Add New Menu Item dynamically
  addMenuItem(itemData) {
    return dbEngine.addMenuItem(itemData);
  }

  // Toggle Item Stock Availability
  toggleAvailability(itemId) {
    return dbEngine.toggleItemAvailability(itemId);
  }

  // Calculate Totals
  calculateOrderTotals(cartItems, taxRate = 5) {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = (subtotal * taxRate) / 100;
    const total = subtotal + tax;

    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2)
    };
  }
}

export const menuService = new MenuService();
