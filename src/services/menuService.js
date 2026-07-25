/**
 * RestaurantOS - Menu & Inventory Management Service Layer
 * Manages category filtering, menu item search, availability toggling, and calculations.
 */

import { dbClient } from './supabaseClient.js';

export class MenuService {
  constructor() {
    this.categories = [];
    this.items = [];
    this.isLoaded = false;
  }

  // Load Menu Data from Database Client
  async loadMenu() {
    const data = await dbClient.getMenu();
    this.categories = data.categories;
    this.items = data.items;
    this.isLoaded = true;
    return data;
  }

  // Get Items Filtered by Category ID
  async getItemsByCategory(categoryId) {
    if (!this.isLoaded) await this.loadMenu();
    if (!categoryId || categoryId === 'ALL') {
      return this.items.filter(i => i.is_available);
    }
    return this.items.filter(i => i.category_id === categoryId && i.is_available);
  }

  // Search Menu Items by Name or Description
  async searchItems(query) {
    if (!this.isLoaded) await this.loadMenu();
    if (!query || !query.trim()) return this.items;

    const term = query.toLowerCase().trim();
    return this.items.filter(item => 
      item.name.toLowerCase().includes(term) || 
      (item.description && item.description.toLowerCase().includes(term))
    );
  }

  // Toggle Item Availability Status
  toggleItemAvailability(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      item.is_available = !item.is_available;
      return { success: true, item };
    }
    return { success: false, error: 'Item not found' };
  }

  // Calculate Order Subtotal & Taxes
  calculateOrderTotals(cartItems, taxRate = 8.5) {
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
