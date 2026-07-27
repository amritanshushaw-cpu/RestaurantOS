/**
 * RestaurantOS - POS Terminal Controller (100% Dynamic Input & Dispatch)
 */

import { menuService } from '../services/menuService.js';
import { dbEngine } from '../services/supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const menuGrid = document.getElementById('pos-menu-grid');
  const categoryBar = document.getElementById('pos-category-bar');
  const cartList = document.getElementById('cart-items-list');
  const tableSelect = document.getElementById('table-select');
  const tableBadge = document.getElementById('active-table-badge');

  const subtotalEl = document.getElementById('cart-subtotal');
  const taxEl = document.getElementById('cart-tax');
  const totalEl = document.getElementById('cart-total');
  const btnDispatch = document.getElementById('btn-dispatch-order');

  const addDishModal = document.getElementById('add-dish-modal');
  const btnOpenAddDish = document.getElementById('btn-open-add-dish');
  const btnCloseAddDish = document.getElementById('btn-close-add-dish');
  const addDishForm = document.getElementById('add-dish-form');

  // Waiter Presence & Task Polling
  const currentUser = JSON.parse(localStorage.getItem('rest_os_google_user'));
  if (currentUser) {
    dbEngine.registerStaffPresence(currentUser.id, currentUser.name, 'Waiter');
  }

  let knownAssignedTables = new Set();
  function checkWaiterTasks() {
    if (!currentUser) return;
    const sessions = dbEngine.getSessions();
    const mySessions = sessions.filter(s => s.waiter_id === currentUser.id && s.status === 'ACTIVE');
    
    mySessions.forEach(s => {
      if (!knownAssignedTables.has(s.table_no)) {
        knownAssignedTables.add(s.table_no);
        alert(`🔔 WAITER TASK: Report to ${s.table_no}!\nA new customer session has started.`);
      }
    });
  }

  setInterval(() => {
    if (currentUser) {
      dbEngine.registerStaffPresence(currentUser.id, currentUser.name, 'Waiter');
      checkWaiterTasks();
    }
  }, 5000);
  
  window.addEventListener('storage', (e) => {
    if (e.key === 'rest_os_sessions') checkWaiterTasks();
  });
  
  // Initialize current known tables
  if (currentUser) checkWaiterTasks();

  let activeCart = [];
  let selectedTable = 'Table 02';
  let currentCategoryFilter = 'ALL';

  if (!menuGrid || !categoryBar) return;

  // Dynamically Render Category Filter Pills
  function renderCategoryPills() {
    const { categories } = menuService.loadMenu();
    categoryBar.innerHTML = `<button class="category-pill ${currentCategoryFilter === 'ALL' ? 'active' : ''}" data-cat="ALL">All Items</button>`;

    (categories || []).forEach(cat => {
      const pill = document.createElement('button');
      pill.className = `category-pill ${currentCategoryFilter === cat.id ? 'active' : ''}`;
      pill.setAttribute('data-cat', cat.id);
      pill.textContent = cat.name;
      categoryBar.appendChild(pill);
    });

    categoryBar.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        categoryBar.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategoryFilter = pill.getAttribute('data-cat');
        renderMenuItems(currentCategoryFilter);
      });
    });
  }

  // Render Dynamic Menu Items
  function renderMenuItems(categoryId) {
    const items = menuService.getItemsByCategory(categoryId);
    menuGrid.innerHTML = '';

    if (!items || items.length === 0) {
      menuGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-tertiary); padding: 40px;">No menu items found in this category.</p>`;
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'food-card';
      card.innerHTML = `
        <img src="${item.image_url}" alt="${item.name}" class="food-img" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';">
        <div class="food-details">
          <div>
            <div class="food-name">${item.name}</div>
            <div class="food-desc">${item.description || ''}</div>
          </div>
          <div class="food-bottom">
            <span class="food-price">₹${parseFloat(item.price).toFixed(2)}</span>
            <button class="add-btn" type="button"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => addToCart(item));
      menuGrid.appendChild(card);
    });
  }

  // Table Selector Sync
  if (tableSelect) {
    tableSelect.addEventListener('change', (e) => {
      selectedTable = e.target.options[e.target.selectedIndex].text.split(' (')[0];
      if (tableBadge) tableBadge.textContent = selectedTable;
    });
  }

  // Cart Management
  function addToCart(item) {
    const existing = activeCart.find(i => i.id === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      activeCart.push({ ...item, quantity: 1 });
    }
    updateCartUI();
  }

  function updateCartUI() {
    if (!cartList) return;

    if (activeCart.length === 0) {
      cartList.innerHTML = `<p style="text-align: center; color: var(--text-tertiary); margin-top: 40px; font-size: 13px;">Cart is empty. Click any food item to add.</p>`;
      if (btnDispatch) btnDispatch.disabled = true;
      if (subtotalEl) subtotalEl.textContent = '₹0.00';
      if (taxEl) taxEl.textContent = '₹0.00';
      if (totalEl) totalEl.textContent = '₹0.00';
      return;
    }

    cartList.innerHTML = '';
    activeCart.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div style="font-size: 11px; color: var(--color-accent-lime); font-weight: 600; font-family: var(--font-mono);">₹${(item.price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="cart-qty-controls">
          <button type="button" class="qty-btn btn-minus" data-index="${index}">-</button>
          <span style="font-size: 13px; font-weight: 700; width: 18px; text-align: center; font-family: var(--font-mono);">${item.quantity}</span>
          <button type="button" class="qty-btn btn-plus" data-index="${index}">+</button>
        </div>
      `;
      cartList.appendChild(row);
    });

    cartList.querySelectorAll('.btn-minus').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
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
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(b.getAttribute('data-index'), 10);
        activeCart[idx].quantity += 1;
        updateCartUI();
      });
    });

    const totals = menuService.calculateOrderTotals(activeCart);
    if (subtotalEl) subtotalEl.textContent = `₹${totals.subtotal}`;
    if (taxEl) taxEl.textContent = `₹${totals.tax}`;
    if (totalEl) totalEl.textContent = `₹${totals.total}`;
    if (btnDispatch) btnDispatch.disabled = false;
  }


  // Real Dynamic Order Dispatch to DB & KDS
  if (btnDispatch) {
    btnDispatch.addEventListener('click', () => {
      if (activeCart.length === 0) return;

      btnDispatch.disabled = true;
      btnDispatch.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...`;

      const instructionsInput = document.getElementById('order-special-instructions');
      const specialInstructions = instructionsInput ? instructionsInput.value.trim() : '';

      const totals = menuService.calculateOrderTotals(activeCart);
      const newOrder = dbEngine.createOrder({
        table_id: tableSelect ? tableSelect.value : 'tbl-02',
        table_number: selectedTable,
        items: [...activeCart],
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        special_instructions: specialInstructions,
        status: 'NEW'
      });

      setTimeout(() => {
        activeCart = [];
        if (instructionsInput) instructionsInput.value = '';
        updateCartUI();
        btnDispatch.innerHTML = `Order Dispatched! <i class="fa-solid fa-check"></i>`;
        btnDispatch.style.background = 'var(--color-accent-lime)';
        btnDispatch.style.color = '#000';

        setTimeout(() => {
          btnDispatch.innerHTML = `Send Order to Kitchen <i class="fa-solid fa-paper-plane"></i>`;
          btnDispatch.style.background = '';
          btnDispatch.style.color = '';
        }, 2500);
      }, 500);
    });
  }

  // Add Dish Modal Interactions
  if (btnOpenAddDish && addDishModal) {
    btnOpenAddDish.addEventListener('click', () => {
      addDishModal.style.display = 'flex';
    });
  }

  if (btnCloseAddDish && addDishModal) {
    btnCloseAddDish.addEventListener('click', () => {
      addDishModal.style.display = 'none';
    });
  }

  if (addDishForm) {
    addDishForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('dish-name').value;
      const category_id = document.getElementById('dish-category').value;
      const price = parseFloat(document.getElementById('dish-price').value);
      const image_url = document.getElementById('dish-photo').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
      const description = document.getElementById('dish-desc').value;

      dbEngine.addMenuItem({ name, category_id, price, image_url, description });
      addDishModal.style.display = 'none';
      addDishForm.reset();

      renderCategoryPills();
      renderMenuItems(currentCategoryFilter);
      alert(`Success! "${name}" added to menu catalog.`);
    });
  }

  // Initial Load
  renderCategoryPills();
  renderMenuItems('ALL');
});
