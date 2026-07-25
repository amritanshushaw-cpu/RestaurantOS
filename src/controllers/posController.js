/**
 * RestaurantOS - POS Terminal Controller Logic
 * Connects category pills, menu item grid rendering, cart management, and order dispatch.
 */

import { menuService } from '../services/menuService.js';
import { dbClient } from '../services/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const menuGrid = document.getElementById('pos-menu-grid');
  const categoryBar = document.getElementById('pos-category-bar');
  const cartList = document.getElementById('cart-items-list');
  const tableSelect = document.getElementById('table-select');
  const tableBadge = document.getElementById('active-table-badge');

  const subtotalEl = document.getElementById('cart-subtotal');
  const taxEl = document.getElementById('cart-tax');
  const totalEl = document.getElementById('cart-total');
  const btnDispatch = document.getElementById('btn-dispatch-order');

  let activeCart = [];
  let selectedTable = 'Table 02';

  // Load Menu Data
  await menuService.loadMenu();
  renderMenuItems('ALL');

  // Render Menu Grid
  async function renderMenuItems(categoryId) {
    const items = await menuService.getItemsByCategory(categoryId);
    menuGrid.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'food-card';
      card.innerHTML = `
        <img src="${item.image_url}" alt="${item.name}" class="food-img">
        <div class="food-details">
          <div>
            <div class="food-name">${item.name}</div>
            <div class="food-desc">${item.description}</div>
          </div>
          <div class="food-bottom">
            <span class="food-price">$${item.price.toFixed(2)}</span>
            <button class="add-btn"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => addToCart(item));
      menuGrid.appendChild(card);
    });
  }

  // Category Bar Click Event
  categoryBar.querySelectorAll('.category-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      categoryBar.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderMenuItems(pill.getAttribute('data-cat'));
    });
  });

  // Table Selector Change Event
  tableSelect.addEventListener('change', (e) => {
    selectedTable = e.target.options[e.target.selectedIndex].text.split(' (')[0];
    tableBadge.textContent = selectedTable;
  });

  // Add Item to Cart
  function addToCart(item) {
    const existing = activeCart.find(i => i.id === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      activeCart.push({ ...item, quantity: 1 });
    }
    updateCartUI();
  }

  // Update Cart UI
  function updateCartUI() {
    if (activeCart.length === 0) {
      cartList.innerHTML = `<p style="text-align: center; color: var(--text-tertiary); margin-top: 40px; font-size: 13px;">Cart is empty. Click any food item to add.</p>`;
      btnDispatch.disabled = true;
      subtotalEl.textContent = '$0.00';
      taxEl.textContent = '$0.00';
      totalEl.textContent = '$0.00';
      return;
    }

    cartList.innerHTML = '';
    activeCart.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div style="font-size: 11px; color: var(--accent-amber); font-weight: 600;">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="cart-qty-controls">
          <button class="qty-btn btn-minus" data-index="${index}">-</button>
          <span style="font-size: 13px; font-weight: 700; width: 18px; text-align: center;">${item.quantity}</span>
          <button class="qty-btn btn-plus" data-index="${index}">+</button>
        </div>
      `;
      cartList.appendChild(row);
    });

    // Quantity Handlers
    cartList.querySelectorAll('.btn-minus').forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.getAttribute('data-index'), 10);
        if (activeCart[idx].quantity > 1) {
          activeCart[idx].quantity -= 1;
        } else {
          activeCart.splice(idx, 1);
        }
        updateCartUI();
      });
    });

    cartList.querySelectorAll('.btn-plus').forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.getAttribute('data-index'), 10);
        activeCart[idx].quantity += 1;
        updateCartUI();
      });
    });

    // Calculate Totals
    const totals = menuService.calculateOrderTotals(activeCart);
    subtotalEl.textContent = `$${totals.subtotal}`;
    taxEl.textContent = `$${totals.tax}`;
    totalEl.textContent = `$${totals.total}`;
    btnDispatch.disabled = false;
  }

  // Dispatch Order to Kitchen (KDS)
  btnDispatch.addEventListener('click', async () => {
    btnDispatch.disabled = true;
    btnDispatch.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...`;

    const totals = menuService.calculateOrderTotals(activeCart);
    const result = await dbClient.createOrder({
      table_id: tableSelect.value,
      table_number: selectedTable,
      items: [...activeCart],
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      status: 'NEW'
    });

    if (result.success) {
      alert(`Order ${result.order.order_number} successfully dispatched to Kitchen KDS!`);
      activeCart = [];
      updateCartUI();
    }

    btnDispatch.innerHTML = `Send Order to Kitchen <i class="fa-solid fa-paper-plane"></i>`;
  });
});
