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

  const currentUser = JSON.parse(localStorage.getItem('rest_os_google_user'));
  if (currentUser) {
    dbEngine.registerStaffPresence(currentUser.id, currentUser.name, 'Waiter');
  }

  // Inject Waiter Tasks Panel
  const mainPosLayout = document.querySelector('.pos-layout');
  if (mainPosLayout) {
    const tasksPanel = document.createElement('div');
    tasksPanel.style.cssText = 'grid-column: 1/-1; background: var(--color-ink-deep); border: 1px solid var(--color-accent-pink); border-radius: var(--radius-xl); padding: 16px; margin-bottom: 16px;';
    tasksPanel.innerHTML = `
      <h3 style="color: var(--color-accent-pink); margin-top: 0; margin-bottom: 12px; font-size: 16px;">🔔 Waiter Task Dashboard (Live)</h3>
      <div id="waiter-order-feed" style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;"></div>
    `;
    mainPosLayout.parentNode.insertBefore(tasksPanel, mainPosLayout);
  }

  function renderWaiterOrderTasks() {
    const feed = document.getElementById('waiter-order-feed');
    if (!feed || !currentUser) return;
    
    const isMyOrderOrUnassigned = (id) => !id || id === currentUser.id || id === 'WAITING' || id === 'WAIT-01';

    const allOrders = dbEngine.getOrders();
    const allSessions = dbEngine.getSessions();

    const activeOrders = allOrders.filter(o => isMyOrderOrUnassigned(o.waiter_id) && ['NEW', 'ACCEPTED', 'SENT_TO_KITCHEN', 'READY', 'COLLECTED'].includes(o.status));
    const activeSessions = allSessions.filter(s => isMyOrderOrUnassigned(s.waiter_id) && s.status === 'ACTIVE' && (!s.order_ids || s.order_ids.length === 0));
    const paymentSessions = allSessions.filter(s => isMyOrderOrUnassigned(s.waiter_id) && s.status === 'PAYMENT_PENDING');
    
    if (activeOrders.length === 0 && activeSessions.length === 0 && paymentSessions.length === 0) {
      feed.innerHTML = '<div style="color: var(--text-tertiary); font-size: 13px;">No pending orders or payments for you right now. Listening for live customer orders...</div>';
      return;
    }
    
    let html = '';
    
    // Render Order Tasks
    html += activeOrders.map(o => {
      let btnAction = ''; let btnLabel = ''; let btnBg = '';
      if (o.status === 'NEW') {
        btnAction = 'ACCEPT'; btnLabel = 'Accept Order'; btnBg = 'var(--color-warning)';
      } else if (o.status === 'ACCEPTED') {
        if (o.chef_id) {
          btnAction = 'SEND'; btnLabel = 'Send to Kitchen'; btnBg = '#3b82f6';
        } else {
          btnLabel = 'Waiting for Chef Login...'; btnBg = 'transparent';
        }
      } else if (o.status === 'SENT_TO_KITCHEN') {
        btnLabel = 'Cooking in Kitchen...'; btnBg = 'transparent';
      } else if (o.status === 'READY') {
        btnAction = 'COLLECT'; btnLabel = 'Collect Order'; btnBg = '#f59e0b';
      } else if (o.status === 'COLLECTED') {
        btnAction = 'DELIVER'; btnLabel = 'Mark as Delivered'; btnBg = '#10b981';
      }

      const buttonHtml = btnAction 
        ? `<button type="button" class="btn-sentry btn-waiter-action" data-id="${o.id}" data-action="${btnAction}" style="width: 100%; background: ${btnBg}; color: #000; padding: 6px;">${btnLabel}</button>` 
        : `<div style="color: var(--text-tertiary); font-size: 12px; text-align: center; padding: 6px; border: 1px dashed var(--border-violet); border-radius: 4px;">${btnLabel}</div>`;

      return `
        <div style="background: var(--color-primary); border: 1px solid ${btnBg !== 'transparent' ? btnBg : 'var(--border-violet)'}; padding: 12px; border-radius: 8px; min-width: 250px;">
          <div style="font-weight: 700; color: #fff;">${o.table_number || o.table_id} - ${o.order_number}</div>
          <div style="font-size: 11px; color: var(--color-accent-lime); margin-bottom: 4px;">Cust: ${o.customer_name || 'Guest'} | Sess: ${o.session_id}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Status: ${o.status} ${o.chef_id ? `| Chef: ${o.chef_id}` : ''}</div>
          ${buttonHtml}
        </div>
      `;
    }).join('');
    
    // Render Seated Customers (No orders yet)
    html += activeSessions.map(s => {
      return `
        <div style="background: var(--color-primary); border: 1px solid #3b82f6; padding: 12px; border-radius: 8px; min-width: 250px; border-left: 4px solid #3b82f6;">
          <div style="font-weight: 700; color: #fff;">${s.table_no} - Seated</div>
          <div style="font-size: 11px; color: var(--color-accent-lime); margin-bottom: 4px;">Cust: ${s.customer_name || 'Guest'} | Sess: ${s.session_id}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Waiting for Customer to order...</div>
        </div>
      `;
    }).join('');
    
    // Render Payment Tasks
    html += paymentSessions.map(s => {
      return `
        <div style="background: var(--color-primary); border: 1px solid #8b5cf6; padding: 12px; border-radius: 8px; min-width: 250px; border-left: 4px solid #8b5cf6;">
          <div style="font-weight: 700; color: #fff;">${s.table_no} - Bill Payment</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Type: ${s.payment_type} (Pending)</div>
          <button type="button" class="btn-sentry btn-waiter-payment" data-session="${s.session_id}" data-type="${s.payment_type}" style="width: 100%; background: #8b5cf6; color: #fff; padding: 6px;">
            Verify & Accept Payment
          </button>
        </div>
      `;
    }).join('');
    
    feed.innerHTML = html;
    
    feed.querySelectorAll('.btn-waiter-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const allOrders = dbEngine.getOrders();
        const o = allOrders.find(x => x.id === orderId);
        if (o) {
          if (action === 'ACCEPT') {
            o.status = 'ACCEPTED';
            o.waiter_id = currentUser.id;
            o.chef_id = dbEngine.allotKitchen();
            const sessionObj = dbEngine.getSessionById(o.session_id);
            if (sessionObj) {
              sessionObj.waiter_id = currentUser.id;
              const allSess = dbEngine.getSessions();
              const idx = allSess.findIndex(s => s.session_id === sessionObj.session_id);
              if (idx !== -1) allSess[idx] = sessionObj;
              dbEngine.saveSessions(allSess);
            }
          } else if (action === 'SEND') {
            o.status = 'SENT_TO_KITCHEN';
          } else if (action === 'COLLECT') {
            o.status = 'COLLECTED';
          } else if (action === 'DELIVER') {
             o.status = 'DELIVERED';
             dbEngine.markOrderServed(orderId);
          }
          localStorage.setItem('rest_os_orders', JSON.stringify(allOrders));
          window.dispatchEvent(new Event('storage'));
          renderWaiterOrderTasks();
        }
      });
    });
    
    feed.querySelectorAll('.btn-waiter-payment').forEach(btn => {
      btn.addEventListener('click', () => {
        const sessionId = btn.getAttribute('data-session');
        const payType = btn.getAttribute('data-type');
        const sessionTarget = dbEngine.getSessionById(sessionId);
        if (sessionTarget) {
          const res = dbEngine.terminateSession(sessionId, payType, sessionTarget.feedback || {});
          alert(`Payment Accepted for ${sessionTarget.table_no}!\nRevenue updated in Manager Dashboard.\n${res.message}`);
          window.dispatchEvent(new Event('storage'));
          renderWaiterOrderTasks();
        }
      });
    });
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
    
    renderWaiterOrderTasks();
  }

  setInterval(() => {
    if (currentUser) {
      dbEngine.registerStaffPresence(currentUser.id, currentUser.name, 'Waiter');
      checkWaiterTasks();
    }
  }, 5000);
  
  window.addEventListener('storage', (e) => {
    checkWaiterTasks();
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
