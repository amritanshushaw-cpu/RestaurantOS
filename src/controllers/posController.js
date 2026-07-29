/**
 * RestaurantOS - POS Terminal Controller (100% Dynamic Input & Dispatch)
 */

import { menuService } from '../services/menuService.js';
import { dbEngine } from '../services/supabaseClient.js';
import { authService } from '../services/authService.js';

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

  let currentUser = authService.user || JSON.parse(localStorage.getItem('rest_os_google_user'));
  if (!currentUser) {
    currentUser = {
      id: 'waiter-' + Date.now(),
      name: 'Sam (Waitstaff)',
      email: 'waiter@restaurantos.com',
      picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Waiter',
      role: 'Waiter',
      auth_provider: 'system'
    };
    authService.saveUser(currentUser);
  } else if (currentUser.role !== 'Waiter') {
    authService.setUserRole('Waiter');
    currentUser = authService.user;
  }
  
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
        btnAction = 'SEND'; btnLabel = 'Send to Kitchen'; btnBg = '#3b82f6';
      } else if (o.status === 'SENT_TO_KITCHEN' || o.status === 'PREPARING') {
        btnLabel = 'Cooking in Kitchen...'; btnBg = 'transparent';
      } else if (o.status === 'READY') {
        btnAction = 'COLLECT'; btnLabel = 'Collect from Kitchen'; btnBg = '#f59e0b';
      } else if (o.status === 'COLLECTED') {
        btnAction = 'DELIVER'; btnLabel = 'Order Delivered'; btnBg = '#10b981';
      }

      const buttonHtml = btnAction 
        ? `<button type="button" class="btn-sentry btn-waiter-action" data-id="${o.id}" data-action="${btnAction}" style="width: 100%; background: ${btnBg}; color: #000; padding: 6px;">${btnLabel}</button>` 
        : `<div style="color: var(--text-tertiary); font-size: 12px; text-align: center; padding: 6px; border: 1px dashed var(--border-violet); border-radius: 4px;">${btnLabel}</div>`;

      const itemsSummary = (o.items || []).map(i => `${i.quantity || 1}x ${i.name || i.item_name}`).join(', ');

      return `
        <div style="background: var(--color-primary); border: 1px solid ${btnBg !== 'transparent' ? btnBg : 'var(--border-violet)'}; padding: 12px; border-radius: 8px; min-width: 270px;">
          <div style="font-weight: 700; color: #fff;">${o.table_number || o.table_id} - ${o.order_number}</div>
          <div style="font-size: 11px; color: var(--color-accent-lime); margin-bottom: 4px;">Cust: ${o.customer_name || 'Guest'} | Sess: ${o.session_id}</div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">Dishes: <strong style="color: #fff;">${itemsSummary || 'Dishes'}</strong></div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Status: <span class="badge" style="background: rgba(194, 239, 78, 0.15); color: var(--color-accent-lime);">${o.status}</span> ${o.chef_id ? `| Chef: ${o.chef_id}` : ''}</div>
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

  // Kitchen Notifications Tab Controller
  const btnNotifTab = document.getElementById('btn-waiter-notif-tab');
  const notifPanel = document.getElementById('waiter-notifications-panel');
  const notifBadge = document.getElementById('waiter-notif-count-badge');
  const btnCloseNotif = document.getElementById('btn-close-waiter-notif');
  const readyAlertsList = document.getElementById('waiter-ready-alerts-list');

  if (btnNotifTab && notifPanel) {
    btnNotifTab.addEventListener('click', () => {
      const isVisible = notifPanel.style.display !== 'none';
      notifPanel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        renderKitchenReadyNotifications();
      }
    });
  }

  if (btnCloseNotif && notifPanel) {
    btnCloseNotif.addEventListener('click', () => {
      notifPanel.style.display = 'none';
    });
  }

  let prevReadyOrderCount = 0;

  function renderKitchenReadyNotifications() {
    const alertsList = document.getElementById('waiter-ready-alerts-list');
    const badge = document.getElementById('waiter-notif-count-badge');
    if (!alertsList) return;

    const allOrders = dbEngine.getOrders();
    const readyOrders = allOrders.filter(o => 
      (o.status === 'READY' || o.status === 'PREPARING' || o.status === 'SENT_TO_KITCHEN' || o.status === 'COLLECTED') && 
      o.delivered !== 'Y'
    );

    if (readyOrders.length > 0) {
      if (badge) {
        badge.textContent = readyOrders.length;
        badge.style.display = 'flex';
      }
      if (readyOrders.length > prevReadyOrderCount) {
        authService.showToast(`🔔 KITCHEN ALERT: ${readyOrders.length} order(s) ready for table delivery!`);
      }
    } else {
      if (badge) {
        badge.style.display = 'none';
      }
    }
    prevReadyOrderCount = readyOrders.length;

    if (readyOrders.length === 0) {
      alertsList.innerHTML = `
        <p style="grid-column: 1/-1; text-align: center; color: var(--text-tertiary); margin: 20px 0; font-size: 13px;">
          <i class="fa-solid fa-square-check" style="color: #10b981; font-size: 24px; display: block; margin-bottom: 8px;"></i>
          No unserved kitchen orders right now. When Kitchen staff completes cooking, alerts appear here instantly!
        </p>
      `;
      return;
    }

    alertsList.innerHTML = readyOrders.map(order => {
      const formattedTime = order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
      const itemsList = (order.items || []).map(i => `${i.quantity}x ${i.name || i.item_name}`).join(', ') || 'Dish Items';

      return `
        <div style="background: var(--color-primary); border: 1.5px solid var(--color-accent-pink); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 8px;">
              <strong style="color: var(--color-accent-lime); font-size: 14px; font-family: var(--font-mono);">${order.order_number}</strong>
              <span class="badge sandbox-badge" style="background: rgba(236,72,153,0.2); color: #ec4899; font-weight: 700;">${order.table_number || order.table_id || 'Table 01'}</span>
            </div>
            
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
              <strong>Dishes Ready:</strong> <span style="color: #fff; font-weight: 600;">${itemsList}</span>
            </div>

            <div style="font-size: 11px; color: var(--text-tertiary);">
              <span><i class="fa-regular fa-clock"></i> ${formattedTime}</span> &nbsp;·&nbsp;
              <span><i class="fa-solid fa-user-ninja"></i> Waiter: ${order.waiter_id || 'Waitstaff'}</span> &nbsp;·&nbsp;
              <span style="color: var(--color-accent-lime); font-weight: 700;">[Status: ${order.status}]</span>
            </div>
          </div>

          <button type="button" class="btn-sentry btn-mark-served-notif" data-id="${order.id || order.order_number}" style="padding: 8px 12px; font-size: 12px; width: 100%; background: #10b981; color: #000; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <i class="fa-solid fa-check-double"></i> Mark Served & Delivered
          </button>
        </div>
      `;
    }).join('');

    alertsList.querySelectorAll('.btn-mark-served-notif').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-id');
        dbEngine.markOrderServed(orderId);
        authService.showToast(`✅ Order ${orderId} marked as SERVED & Delivered to customer!`);
        renderKitchenReadyNotifications();
        window.dispatchEvent(new Event('storage'));
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
    renderKitchenReadyNotifications();
  }

  setInterval(() => {
    if (currentUser) {
      dbEngine.registerStaffPresence(currentUser.id, currentUser.name, 'Waiter');
      checkWaiterTasks();
    }
  }, 3000);
  
  window.addEventListener('storage', (e) => {
    checkWaiterTasks();
  });
  
  // Initialize current known tables and notifications
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

  // Waiter Section: Generate Bill & Pay Modal Engine
  const btnGenerateBillPos = document.getElementById('btn-generate-bill-pos');
  if (btnGenerateBillPos) {
    btnGenerateBillPos.addEventListener('click', () => {
      openWaiterBillPaymentModal();
    });
  }

  function openWaiterBillPaymentModal(initialTable) {
    const defaultTable = initialTable || selectedTable || (tableSelect ? tableSelect.options[tableSelect.selectedIndex].text.split(' (')[0] : 'Table 01');

    const existingModal = document.getElementById('pos-payment-bill-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div id="pos-payment-bill-modal" class="entry-gateway-backdrop" style="z-index: 10000; display: flex; align-items: center; justify-content: center;">
        <div class="entry-modal-card" style="max-width: 600px; width: 95%; padding: 28px; text-align: left; background: var(--color-ink-deep); border: 1.5px solid var(--color-accent-lime); box-shadow: 0 24px 60px rgba(0,0,0,0.8);">
          
          <!-- Header Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-violet); padding-bottom: 12px;">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--color-accent-lime); text-transform: uppercase; letter-spacing: 0.5px;">
                <i class="fa-solid fa-file-invoice-dollar"></i> Waiter Billing Terminal
              </div>
              <h2 id="pos-bill-title" style="font-size: 22px; font-weight: 700; color: #fff; margin: 4px 0 0;">Bill & Payment — ${defaultTable}</h2>
            </div>
            <button type="button" id="btn-close-pos-bill" style="background: transparent; border: none; color: var(--text-tertiary); font-size: 24px; cursor: pointer;">&times;</button>
          </div>

          <!-- Select Table Picker -->
          <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-violet); padding: 10px 14px; border-radius: var(--radius-md);">
            <label for="pos-billing-table-select" style="font-size: 12px; font-weight: 700; color: var(--color-accent-lime); text-transform: uppercase; white-space: nowrap;">
              <i class="fa-solid fa-chair"></i> Choose Table:
            </label>
            <select id="pos-billing-table-select" style="flex: 1; background: var(--color-primary); border: 1px solid var(--border-violet); color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 700; font-family: var(--font-sans); outline: none;">
              <option value="Table 01" ${defaultTable.includes('01') ? 'selected' : ''}>Table 01 (2 Seats · Patio)</option>
              <option value="Table 02" ${defaultTable.includes('02') ? 'selected' : ''}>Table 02 (4 Seats · Main Hall)</option>
              <option value="Table 03" ${defaultTable.includes('03') ? 'selected' : ''}>Table 03 (4 Seats · Main Hall)</option>
              <option value="Table 04" ${defaultTable.includes('04') ? 'selected' : ''}>Table 04 (6 Seats · VIP Booth)</option>
              <option value="Table 05" ${defaultTable.includes('05') ? 'selected' : ''}>Table 05 (2 Seats · Patio)</option>
              <option value="Table 06" ${defaultTable.includes('06') ? 'selected' : ''}>Table 06 (8 Seats · Main Hall)</option>
              <option value="Table 07" ${defaultTable.includes('07') ? 'selected' : ''}>Table 07 (2 Seats · Terrace)</option>
              <option value="Table 08" ${defaultTable.includes('08') ? 'selected' : ''}>Table 08 (4 Seats · Main Hall)</option>
              <option value="Table 09" ${defaultTable.includes('09') ? 'selected' : ''}>Table 09 (6 Seats · VIP Booth)</option>
              <option value="Table 10" ${defaultTable.includes('10') ? 'selected' : ''}>Table 10 (8 Seats · Terrace)</option>
            </select>
          </div>

          <!-- Dynamic Billing Area Container -->
          <div id="pos-billing-dynamic-area"></div>

          <!-- Select Payment Mode -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px;">Select Received Payment Mode:</label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
              <button type="button" class="btn-pos-pay-type active" data-type="UPI" style="background: var(--color-primary); border: 1.5px solid var(--color-accent-lime); color: #fff; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; text-align: center;">
                <i class="fa-solid fa-qrcode" style="color: var(--color-accent-lime);"></i><br>UPI / QR
              </button>
              <button type="button" class="btn-pos-pay-type" data-type="Card" style="background: var(--color-primary); border: 1.5px solid var(--border-violet); color: #fff; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; text-align: center;">
                <i class="fa-solid fa-credit-card" style="color: var(--color-accent-pink);"></i><br>Credit/Debit Card
              </button>
              <button type="button" class="btn-pos-pay-type" data-type="Cash" style="background: var(--color-primary); border: 1.5px solid var(--border-violet); color: #fff; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; text-align: center;">
                <i class="fa-solid fa-money-bill-wave" style="color: #3b82f6;"></i><br>Cash Payment
              </button>
            </div>
          </div>

          <div style="display: flex; gap: 12px;">
            <button type="button" id="btn-confirm-pos-payment" class="btn-sentry" style="flex: 2; padding: 12px; font-size: 13px;">
              Collect Payment & Vacate Table <i class="fa-solid fa-check-double"></i>
            </button>
            <button type="button" id="btn-reset-pos-table-orders" class="btn-ghost-sm" style="flex: 1; padding: 12px; font-size: 12px; color: var(--color-accent-pink); border: 1.5px solid rgba(236,72,153,0.5);">
              <i class="fa-solid fa-rotate-left"></i> Reset Table
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const posModal = document.getElementById('pos-payment-bill-modal');
    const tableSelectEl = document.getElementById('pos-billing-table-select');
    const dynamicArea = document.getElementById('pos-billing-dynamic-area');
    const billTitle = document.getElementById('pos-bill-title');
    let selectedPayType = 'UPI';

    document.getElementById('btn-reset-pos-table-orders')?.addEventListener('click', () => {
      const activeTable = posModal.dataset.currentTable || tableSelectEl.value;
      const cleanNum = activeTable.replace('Table ', '').replace('tbl-', '').padStart(2, '0');
      const stdTable = `Table ${cleanNum}`;
      const tblId = `tbl-${cleanNum}`;

      const orders = dbEngine.getOrders();
      let updatedOrders = false;
      orders.forEach(o => {
        const t = String(o.table_number || o.table_id || o.table_no || '');
        if (t === stdTable || t === tblId || t.endsWith(cleanNum)) {
          o.status = 'COMPLETED';
          o.delivered = 'Y';
          updatedOrders = true;
        }
      });
      if (updatedOrders) {
        localStorage.setItem('rest_os_orders', JSON.stringify(orders));
      }

      const sessions = dbEngine.getSessions();
      sessions.forEach(s => {
        if (s.table_no === stdTable || s.table_no === tblId || s.table_no === activeTable) {
          s.status = 'TERMINATED';
        }
      });
      dbEngine.saveSessions(sessions);

      dbEngine.updateTableStatus(stdTable, 'AVAILABLE');
      dbEngine.updateTableStatus(tblId, 'AVAILABLE');

      if (typeof activeCart !== 'undefined') {
        activeCart = [];
        renderCart();
      }

      authService.showToast(`✅ ${stdTable} has been reset & cleared! Table is now VACANT.`);
      updateBillingDetails(activeTable);
      window.dispatchEvent(new Event('storage'));
    });

    function updateBillingDetails(tableStr) {
      billTitle.textContent = `Bill & Payment — ${tableStr}`;
      
      const sessions = dbEngine.getSessions();
      const orders = dbEngine.getOrders();
      const cleanNum = tableStr.replace('Table ', '').replace('tbl-', '').padStart(2, '0');
      const stdTable = `Table ${cleanNum}`;
      const tblId = `tbl-${cleanNum}`;

      const targetSession = sessions.find(s => 
        (s.table_no === stdTable || s.table_no === tblId || s.table_no === `Table ${parseInt(cleanNum)}`) && 
        s.status !== 'TERMINATED' && s.status !== 'COMPLETED' && s.status !== 'PAID'
      );

      const matchingOrders = orders.filter(o => {
        if (['CANCELLED', 'COMPLETED', 'PAID', 'TERMINATED'].includes(o.status)) return false;
        const t = String(o.table_number || o.table_id || o.table_no || '');
        const isTableMatch = t === stdTable || t === tblId || t === `Table ${parseInt(cleanNum)}`;
        const isSessionMatch = targetSession && o.session_id === targetSession.session_id;
        return isTableMatch || isSessionMatch;
      });

      let billItems = [];
      matchingOrders.forEach(o => {
        if (Array.isArray(o.items) && o.items.length > 0) {
          o.items.forEach(item => {
            const existing = billItems.find(i => (i.id && i.id === item.id) || i.name === (item.name || item.item_name));
            if (existing) {
              existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
            } else {
              billItems.push({
                id: item.id || `item-${Date.now()}`,
                name: item.name || item.item_name || 'Dish Item',
                price: parseFloat(item.price || 0),
                quantity: item.quantity || 1
              });
            }
          });
        }
      });

      if (selectedTable === stdTable && activeCart && activeCart.length > 0 && billItems.length === 0) {
        activeCart.forEach(item => {
          billItems.push({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price || 0),
            quantity: item.quantity || 1
          });
        });
      }

      let subtotal = 0;
      if (billItems.length > 0) {
        subtotal = billItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      } else if (matchingOrders.length > 0) {
        subtotal = matchingOrders.reduce((sum, o) => sum + parseFloat(o.total || o.subtotal || 0), 0);
      } else {
        subtotal = 0;
      }

      const tax = parseFloat((subtotal * 0.05).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      dynamicArea.innerHTML = `
        <div style="background: var(--color-primary); border: 1px solid var(--border-violet); padding: 12px 16px; border-radius: var(--radius-md); font-size: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div><strong>Table:</strong> ${stdTable}</div>
          <div><strong>Session ID:</strong> <span class="mono">${targetSession ? targetSession.session_id : 'SESS-' + Math.floor(100000 + Math.random() * 900000)}</span></div>
          <div><strong>Customer:</strong> ${targetSession ? (targetSession.customer_name || 'Signed Guest') : 'Customer'}</div>
          <div><strong>Waiter:</strong> ${currentUser ? currentUser.name : 'Waitstaff'}</div>
        </div>

        <div style="max-height: 180px; overflow-y: auto; margin-bottom: 16px; border: 1px solid var(--border-violet); border-radius: 8px; padding: 10px; background: rgba(0,0,0,0.2);">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-violet); color: var(--text-tertiary);">
                <th style="padding: 6px;">Item</th>
                <th style="padding: 6px; text-align: center;">Qty</th>
                <th style="padding: 6px; text-align: right;">Price</th>
                <th style="padding: 6px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${billItems.length > 0 ? billItems.map(item => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 6px; color: #fff; font-weight: 600;">${item.name}</td>
                  <td style="padding: 6px; text-align: center;">${item.quantity}</td>
                  <td style="padding: 6px; text-align: right; font-family: var(--font-mono);">₹${item.price.toFixed(2)}</td>
                  <td style="padding: 6px; text-align: right; font-family: var(--font-mono); color: var(--color-accent-lime);">₹${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="4" style="padding: 16px; text-align: center; color: var(--text-tertiary);">
                    <i class="fa-solid fa-circle-info" style="color: var(--color-accent-lime); margin-right: 6px;"></i> No active unbilled dishes placed for ${stdTable}. Table check is clear (₹0.00).
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <div style="background: rgba(194, 239, 78, 0.05); border: 1px solid rgba(194, 239, 78, 0.2); padding: 14px; border-radius: var(--radius-md); margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
            <span>Subtotal:</span> <strong style="color: #fff; font-family: var(--font-mono);">₹${subtotal.toFixed(2)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
            <span>Taxes & Service (5% GST):</span> <strong style="color: #fff; font-family: var(--font-mono);">₹${tax.toFixed(2)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: var(--color-accent-lime); border-top: 1px dashed rgba(194, 239, 78, 0.3); padding-top: 8px; margin-top: 6px;">
            <span>Grand Total:</span> <span style="font-family: var(--font-mono);">₹${total.toFixed(2)}</span>
          </div>
        </div>
      `;

      posModal.dataset.currentTable = stdTable;
      posModal.dataset.currentTotal = total.toFixed(2);
    }

    updateBillingDetails(tableSelectEl.value);

    tableSelectEl.addEventListener('change', (e) => {
      updateBillingDetails(e.target.value);
    });

    posModal.querySelectorAll('.btn-pos-pay-type').forEach(btn => {
      btn.addEventListener('click', () => {
        posModal.querySelectorAll('.btn-pos-pay-type').forEach(b => b.style.borderColor = 'var(--border-violet)');
        btn.style.borderColor = 'var(--color-accent-lime)';
        selectedPayType = btn.dataset.type;
      });
    });

    document.getElementById('btn-close-pos-bill')?.addEventListener('click', () => posModal.remove());

    document.getElementById('btn-confirm-pos-payment')?.addEventListener('click', () => {
      try {
        const activeTable = posModal.dataset.currentTable || tableSelectEl.value;
        const activeTotal = posModal.dataset.currentTotal || '1663.30';

        const cleanNum = activeTable.replace('Table ', '').replace('tbl-', '').padStart(2, '0');
        const stdTable = `Table ${cleanNum}`;
        const tblId = `tbl-${cleanNum}`;

        const sessions = dbEngine.getSessions();
        const targetSession = sessions.find(s => 
          (s.table_no === stdTable || s.table_no === tblId || s.table_no === activeTable) && 
          s.status !== 'TERMINATED'
        );

        if (targetSession) {
          dbEngine.terminateSession(targetSession.session_id, selectedPayType, { rating: 5, reviewText: 'Paid & Vacated via Waiter POS' });
        } else {
          dbEngine.updateTableStatus(stdTable, 'AVAILABLE');
          dbEngine.updateTableStatus(tblId, 'AVAILABLE');
        }

        const orders = dbEngine.getOrders();
        let updatedOrders = false;
        orders.forEach(o => {
          const t = String(o.table_number || o.table_id || o.table_no || '');
          if (t === stdTable || t === tblId || t.endsWith(cleanNum)) {
            o.status = 'COMPLETED';
            o.delivered = 'Y';
            updatedOrders = true;
          }
        });
        if (updatedOrders) {
          localStorage.setItem('rest_os_orders', JSON.stringify(orders));
        }

        localStorage.removeItem('rest_os_active_session');

        if (window.authService && window.authService.showToast) {
          window.authService.showToast(`✅ Payment of ₹${activeTotal} (${selectedPayType}) recorded for ${stdTable}! Session TERMINATED & Table is now VACANT.`);
        } else {
          alert(`✅ Payment of ₹${activeTotal} (${selectedPayType}) recorded for ${stdTable}! Table is now VACANT.`);
        }
        posModal.remove();
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Error confirming POS payment:', err);
        posModal.remove();
        window.dispatchEvent(new Event('storage'));
      }
    });
  }

  // Initial Load
  renderCategoryPills();
  renderMenuItems('ALL');
});
