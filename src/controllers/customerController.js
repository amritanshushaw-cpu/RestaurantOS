/**
 * RestaurantOS - Customer Portal Controller
 * Manages customer menu browsing, cart selection, cooking notes, live bill calculations & payment checkout.
 */

import { menuService } from '../services/menuService.js';
import { dbEngine } from '../services/supabaseClient.js';
import { authService } from '../services/authService.js';

document.addEventListener('DOMContentLoaded', () => {
  const menuGrid = document.getElementById('cust-menu-grid');
  const categoryBar = document.getElementById('cust-category-bar');
  const searchInput = document.getElementById('cust-search-input');

  const cartList = document.getElementById('cust-cart-list');
  const tableSelect = document.getElementById('cust-table-select');
  const tableBadge = document.getElementById('cust-table-badge');
  const specialNotesInput = document.getElementById('cust-special-notes');

  const subtotalEl = document.getElementById('cust-bill-subtotal');
  const taxEl = document.getElementById('cust-bill-tax');
  const totalEl = document.getElementById('cust-bill-total');
  const btnCheckout = document.getElementById('btn-cust-checkout');

  const profileAvatar = document.getElementById('cust-profile-avatar');
  const greetingName = document.getElementById('cust-greeting-name');

  let activeCart = [];
  let currentCategory = 'ALL';
  let selectedTable = 'Table 02';
  let selectedTipPct = 0;

  if (!menuGrid || !categoryBar) return;

  // Initialize Customer Profile Banner
  function updateCustomerProfile(user) {
    if (user && profileAvatar && greetingName) {
      profileAvatar.src = user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`;
      greetingName.textContent = `Welcome, ${user.name}! 👋`;
    }
  }
  updateCustomerProfile(authService.user);
  window.addEventListener('auth:changed', (e) => updateCustomerProfile(e.detail.user));

  // Render Categories
  function renderCategories() {
    const { categories } = menuService.loadMenu();
    categoryBar.innerHTML = `<button class="category-pill ${currentCategory === 'ALL' ? 'active' : ''}" data-cat="ALL">All Items</button>`;

    (categories || []).forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `category-pill ${currentCategory === cat.id ? 'active' : ''}`;
      btn.setAttribute('data-cat', cat.id);
      btn.textContent = cat.name;
      categoryBar.appendChild(btn);
    });

    categoryBar.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        categoryBar.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategory = pill.getAttribute('data-cat');
        renderMenu();
      });
    });
  }

  // Quick suggestion chips handler
  const chipContainer = document.getElementById('quick-notes-chips');
  if (chipContainer && specialNotesInput) {
    chipContainer.querySelectorAll('.chip-note').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = chip.getAttribute('data-text');
        const current = specialNotesInput.value.trim();
        if (current) {
          if (!current.includes(text)) {
            specialNotesInput.value = `${current}, ${text}`;
          }
        } else {
          specialNotesInput.value = text;
        }
      });
    });
  }

  // Render Menu Grid
  function renderMenu() {
    let items = menuService.getItemsByCategory(currentCategory);
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (searchVal) {
      items = items.filter(i =>
        i.name.toLowerCase().includes(searchVal) ||
        (i.description && i.description.toLowerCase().includes(searchVal))
      );
    }

    menuGrid.innerHTML = '';

    if (!items || items.length === 0) {
      menuGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-tertiary); padding: 40px;">No dishes found. Try clearing your search or category filter.</p>`;
      return;
    }

    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'food-card';

      const tagHTML = idx % 3 === 0 ? `<span class="diet-badge tag-signature">🔥 Chef's Signature</span>` :
                      idx % 3 === 1 ? `<span class="diet-badge tag-gf">🌿 Gluten-Free</span>` :
                                      `<span class="diet-badge tag-v">🌱 Vegetarian</span>`;

      card.innerHTML = `
        <div style="position: relative;">
          <img src="${item.image_url}" alt="${item.name}" class="food-img" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';">
          ${tagHTML}
        </div>
        <div class="food-details">
          <div>
            <div class="food-name">${item.name}</div>
            <div class="food-desc">${item.description || ''}</div>
          </div>
          <div class="food-bottom">
            <span class="food-price">₹${parseFloat(item.price).toFixed(2)}</span>
            <button class="add-btn" type="button" title="Add to Order">+ Order</button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => addToCart(item));
      menuGrid.appendChild(card);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => renderMenu());

  }

  // Table Selector
  if (tableSelect) {
    tableSelect.addEventListener('change', (e) => {
      selectedTable = e.target.value;
      if (tableBadge) tableBadge.textContent = selectedTable;
    });
  }

  // Tip Selector Pills
  document.querySelectorAll('.tip-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.tip-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTipPct = parseInt(pill.getAttribute('data-tip'), 10) || 0;
      updateBillSummaryUI();
    });
  });

  // Cart Operations
  function addToCart(item) {
    const existing = activeCart.find(i => i.id === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      activeCart.push({ ...item, quantity: 1 });
    }
    updateBillSummaryUI();
  }

  function updateBillSummaryUI() {
    if (!cartList) return;

    if (activeCart.length === 0) {
      cartList.innerHTML = `<p style="text-align: center; color: var(--text-tertiary); margin-top: 30px; font-size: 13px;">Your cart is empty. Click any gourmet dish on the left to add.</p>`;
      if (btnCheckout) btnCheckout.disabled = true;
      if (subtotalEl) subtotalEl.textContent = '₹0.00';
      if (taxEl) taxEl.textContent = '₹0.00';
      if (totalEl) totalEl.textContent = '₹0.00';
      return;
    }

    cartList.innerHTML = '';
    activeCart.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div style="font-size: 11px; color: var(--color-accent-lime); font-weight: 600; font-family: var(--font-mono);">₹${(item.price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="cart-qty-controls">
          <button type="button" class="qty-btn btn-minus" data-idx="${idx}">-</button>
          <span style="font-size: 13px; font-weight: 700; width: 18px; text-align: center; font-family: var(--font-mono);">${item.quantity}</span>
          <button type="button" class="qty-btn btn-plus" data-idx="${idx}">+</button>
        </div>
      `;
      cartList.appendChild(row);
    });

    cartList.querySelectorAll('.btn-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (activeCart[idx].quantity > 1) {
          activeCart[idx].quantity -= 1;
        } else {
          activeCart.splice(idx, 1);
        }
        updateBillSummaryUI();
      });
    });

    cartList.querySelectorAll('.btn-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        activeCart[idx].quantity += 1;
        updateBillSummaryUI();
      });
    });

    // Bill Math
    const totals = menuService.calculateOrderTotals(activeCart);
    const subtotal = parseFloat(totals.subtotal);
    const tax = parseFloat(totals.tax);
    const tipAmount = parseFloat(((subtotal * selectedTipPct) / 100).toFixed(2));
    const grandTotal = (subtotal + tax + tipAmount).toFixed(2);

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `₹${(tax + tipAmount).toFixed(2)}${tipAmount > 0 ? ` (incl. ₹${tipAmount.toFixed(2)} tip)` : ''}`;
    if (totalEl) totalEl.textContent = `₹${grandTotal}`;
    if (btnCheckout) btnCheckout.disabled = false;
  }


  // Checkout & Pay Bill
  if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
      if (activeCart.length === 0) return;

      btnCheckout.disabled = true;
      btnCheckout.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Order Bill...`;

      const totals = menuService.calculateOrderTotals(activeCart);
      const subtotal = parseFloat(totals.subtotal);
      const tax = parseFloat(totals.tax);
      const tipAmount = parseFloat(((subtotal * selectedTipPct) / 100).toFixed(2));
      const grandTotal = (subtotal + tax + tipAmount).toFixed(2);

      const specialNotes = specialNotesInput ? specialNotesInput.value.trim() : '';
      const currentUser = authService.user;

      const newOrder = dbEngine.createOrder({
        table_id: selectedTable,
        table_number: selectedTable,
        customer_name: currentUser ? currentUser.name : 'Customer',
        customer_email: currentUser ? currentUser.email : 'guest@restaurantos.demo',
        items: [...activeCart],
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        tip: tipAmount.toFixed(2),
        total: grandTotal,
        special_instructions: specialNotes,
        status: 'NEW'
      });

      // Redirect to Payment Gateway
      setTimeout(() => {
        window.location.href = `payment.html?orderId=${newOrder.id}&total=${grandTotal}`;
      }, 600);
    });
  }

  renderCategories();
  renderMenu();
});
