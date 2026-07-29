/**
 * RestaurantOS - Customer Landing Controller
 * Keeps the remixed editorial landing page connected to the live customer menu,
 * cart, table selection, cooking notes, tips, auth state, and checkout flow.
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
  const dockCount = document.getElementById('cust-dock-count');
  const dockTotal = document.getElementById('cust-dock-total');
  const orderDrawer = document.getElementById('cust-order-drawer');
  const orderDrawerClose = document.getElementById('cust-order-drawer-close');

  if (!menuGrid || !categoryBar) return;

  let activeCart = [];
  let currentCategory = 'ALL';
  let selectedTable = tableSelect?.value || 'Table 02';
  let selectedTipPct = 0;
  let lastOrderTrigger = null;
  let menuData = { categories: [], items: [] };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));

  function updateCustomerProfile(user) {
    if (!user) return;

    const name = user.name || 'Guest';
    if (profileAvatar) {
      profileAvatar.src = user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email || name)}`;
      profileAvatar.alt = `${name} profile`;
    }
    if (greetingName) greetingName.textContent = name;
  }

  updateCustomerProfile(authService.user);
  window.addEventListener('auth:changed', (event) => updateCustomerProfile(event.detail.user));

  function getVisualCategories() {
    const categories = [...(menuData.categories || [])].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const customerPicks = ['Butter Chicken (Murgh Makhani)', 'Steamed Truffle Edamame Dim Sum (6 pcs)', 'Dry-Aged Ribeye Steak 12oz', 'Mango Lassi Alphonso', 'Garlic Butter Naan']
      .map((name) => menuData.items.find((item) => item.name === name))
      .filter(Boolean);

    return [
      ...categories.map((category, index) => ({
        ...category,
        className: category.id === 'cat-03' ? 'darkcat' : category.id === 'cat-chinese' ? 'butcat' : '',
        status: category.id === 'cat-05' ? 'ROYAL INDIAN' :
                category.id === 'cat-continental' ? "CHEF'S BOARD" :
                category.id === 'cat-chinese' ? 'WOK & STEAM' :
                category.id === 'cat-01' ? 'STARTERS' :
                category.id === 'cat-03' ? 'FROM THE BAR' : 'SWEET FINISH',
        description: category.id === 'cat-05'
          ? 'Rich gravies, dum biryanis, tandoori grills & clay oven naans.'
          : category.id === 'cat-continental'
            ? 'Dry-aged steaks, pan-seared salmon, truffle risottos & pasta.'
            : category.id === 'cat-chinese'
              ? 'Dim sums, wok-tossed hakka noodles, Schezwan & Indo-Chinese.'
              : category.id === 'cat-01'
                ? 'Crispy samosas, paneer tikka, bruschetta & first bites.'
                : category.id === 'cat-03'
                  ? 'Chilled Alphonso lassi, masala chai, cocktails & sodas.'
                  : 'Warm gulab jamuns, saffron rasmalai & molten lava cakes.'
      })),
      {
        id: 'CUSTOMER_PICKS',
        name: 'Customer Favorites',
        className: 'butcat',
        status: 'POPULAR PICKS',
        description: 'Top-rated dishes loved by our guests.',
        items: customerPicks,
        virtual: true
      }
    ];
  }

  function setupCategoryBarSlider() {
    if (!categoryBar || categoryBar.dataset.sliderInitialized) return;
    categoryBar.dataset.sliderInitialized = 'true';

    const btnLeft = document.getElementById('btn-cat-slide-left');
    const btnRight = document.getElementById('btn-cat-slide-right');

    btnLeft?.addEventListener('click', () => {
      categoryBar.scrollBy({ left: -260, behavior: 'smooth' });
    });

    btnRight?.addEventListener('click', () => {
      categoryBar.scrollBy({ left: 260, behavior: 'smooth' });
    });

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    categoryBar.addEventListener('pointerdown', (e) => {
      isDown = true;
      categoryBar.classList.add('active-drag');
      startX = e.pageX - categoryBar.offsetLeft;
      scrollLeft = categoryBar.scrollLeft;
    });

    categoryBar.addEventListener('pointerleave', () => {
      isDown = false;
      categoryBar.classList.remove('active-drag');
    });

    categoryBar.addEventListener('pointerup', () => {
      isDown = false;
      categoryBar.classList.remove('active-drag');
    });

    categoryBar.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - categoryBar.offsetLeft;
      const walk = (x - startX) * 1.5;
      categoryBar.scrollLeft = scrollLeft - walk;
    });
  }

  function renderCategories() {
    const categories = getVisualCategories();
    categoryBar.innerHTML = '';

    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = `category-pill ${currentCategory === 'ALL' ? 'active' : ''}`;
    allButton.dataset.cat = 'ALL';
    allButton.textContent = 'All Items';
    categoryBar.appendChild(allButton);

    categories.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `category-pill ${currentCategory === category.id ? 'active' : ''}`;
      button.dataset.cat = category.id;
      button.textContent = category.name;
      categoryBar.appendChild(button);
    });

    categoryBar.querySelectorAll('.category-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        categoryBar.querySelectorAll('.category-pill').forEach((item) => item.classList.remove('active'));
        pill.classList.add('active');
        currentCategory = pill.dataset.cat || 'ALL';
        pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        renderMenu();
      });
    });

    setupCategoryBarSlider();
  }

  function getFilteredItems(category) {
    let items = category.virtual
      ? category.items || []
      : menuService.getItemsByCategory(category.id);
    const searchValue = searchInput?.value.trim().toLowerCase() || '';

    if (searchValue) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(searchValue) ||
        (item.description && item.description.toLowerCase().includes(searchValue))
      );
    }

    return items;
  }

  function getItemDietaryTag(item) {
    if (!item || !item.name) return '';
    const name = item.name.toLowerCase();
    const desc = (item.description || '').toLowerCase();

    if (Array.isArray(item.tags) && item.tags.length > 0) {
      return item.tags.join(' ');
    }

    const isNonVeg = /chicken|mutton|pork|beef|steak|ribeye|salmon|fish|prawn|lobster|duck|calamari|lamb|guanciale|wings|bacon|ham|momos|cod/i.test(name) ||
                     /chicken|mutton|pork|beef|steak|salmon|fish|prawn|lobster|duck|calamari|lamb|ham/i.test(desc);

    const hasDairy = /paneer|butter|cheese|cheddar|alfredo|cream|creamy|bisque|malai|lassi|milk|tiramisu|rasmalai|ice cream|mozzarella|gruyère|parmesan|mascarpone|chai|kofta|makhani|culp|fettuccine/i.test(name) ||
                     /paneer|butter|cheese|cheddar|cream|bisque|malai|lassi|milk|mozzarella|parmesan|mascarpone|makhani/i.test(desc);

    const isVegan = !isNonVeg && !hasDairy && (
      /vegan|edamame|tofu|aloo|gobi|samosa|bruschetta|mojito|old fashioned|chole|manchurian|spring roll|honey chilli potato|roti|hakka noodles|spinach|salad|dim sum|kulcha/i.test(name) ||
      /vegan|plant-based|edamame|tofu|veggies/i.test(desc)
    );

    if (hasDairy) return 'D';
    if (isVegan) return 'V';
    return '';
  }

  function renderMenu() {
    const categories = getVisualCategories()
      .filter((category) => currentCategory === 'ALL' || currentCategory === category.id);

    menuGrid.innerHTML = '';
    let renderedItems = 0;

    categories.forEach((category) => {
      const items = getFilteredItems(category);
      if (items.length === 0) return;

      const section = document.createElement('section');
      section.className = `cat ${category.className || ''}`;
      section.setAttribute('aria-labelledby', `category-${category.id}`);

      const categoryHead = document.createElement('div');
      categoryHead.className = 'cat-head';
      categoryHead.innerHTML = `
        <h3 id="category-${escapeHTML(category.id)}">${escapeHTML(category.name)}</h3>
        ${category.status ? `<span class="cat-time">${escapeHTML(category.status)}</span>` : ''}
      `;

      const categoryDescription = document.createElement('p');
      categoryDescription.className = 'cat-sub';
      categoryDescription.textContent = category.description || 'Built fresh for your table.';

      section.append(categoryHead, categoryDescription);

      items.forEach((item) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'row menu-order-row';
        row.dataset.itemId = item.id;
        row.setAttribute('aria-label', `Add ${item.name} to order`);

        const tag = getItemDietaryTag(item);
        row.innerHTML = `
          <span class="nm">${escapeHTML(item.name)}</span>
          ${tag ? `<span class="tag">${tag}</span>` : ''}
          <span class="leader" aria-hidden="true"></span>
          <span class="pr">${escapeHTML(Number(item.price).toFixed(0))}</span>
        `;
        row.addEventListener('click', () => {
          addToCart(item);
          openOrderDrawer();
        });
        section.appendChild(row);
        renderedItems += 1;
      });

      menuGrid.appendChild(section);
    });

    if (renderedItems === 0) {
      menuGrid.innerHTML = '<p class="empty-state">No dishes found. Try clearing your search or choosing another menu category.</p>';
      return;
    }

    requestAnimationFrame(() => {
      menuGrid.querySelectorAll('.row').forEach((row) => row.classList.add('shown'));
    });
  }

  function renderFavoriteButtons() {
    document.querySelectorAll('[data-favorite-item]').forEach((favorite) => {
      const addButton = favorite.querySelector('.reg-add');
      const itemName = favorite.dataset.favoriteItem;
      const item = menuData.items.find((menuItem) => menuItem.name === itemName);
      if (!addButton || !item) return;

      addButton.addEventListener('click', (event) => {
        event.stopPropagation();
        addToCart(item);
        openOrderDrawer();
      });
    });
  }

  function renderCart() {
    if (!cartList) return;

    if (activeCart.length === 0) {
      cartList.innerHTML = '<p class="empty-state">Your order is empty. Choose any dish to add it here.</p>';
      return;
    }

    cartList.innerHTML = '';
    activeCart.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div>
          <div class="cart-item-name">${escapeHTML(item.name)}</div>
          <div class="mono">${formatCurrency(item.price * item.quantity)}</div>
        </div>
        <div class="cart-qty-controls" aria-label="Quantity for ${escapeHTML(item.name)}">
          <button type="button" class="qty-btn btn-minus" data-idx="${index}" aria-label="Remove one ${escapeHTML(item.name)}">−</button>
          <span aria-live="polite">${item.quantity}</span>
          <button type="button" class="qty-btn btn-plus" data-idx="${index}" aria-label="Add one ${escapeHTML(item.name)}">+</button>
        </div>
      `;
      cartList.appendChild(row);
    });

    cartList.querySelectorAll('.btn-minus').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.idx);
        if (!activeCart[index]) return;
        activeCart[index].quantity > 1 ? activeCart[index].quantity -= 1 : activeCart.splice(index, 1);
        updateBillSummaryUI();
      });
    });

    cartList.querySelectorAll('.btn-plus').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.idx);
        if (!activeCart[index]) return;
        activeCart[index].quantity += 1;
        updateBillSummaryUI();
      });
    });
  }

  function updateBillSummaryUI() {
    renderCart();
    const totals = menuService.calculateOrderTotals(activeCart);
    const subtotal = Number(totals.subtotal);
    const tax = Number(totals.tax);
    const tipAmount = Number(((subtotal * selectedTipPct) / 100).toFixed(2));
    const grandTotal = subtotal + tax + tipAmount;
    const itemCount = activeCart.reduce((total, item) => total + item.quantity, 0);

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (taxEl) taxEl.textContent = `${formatCurrency(tax + tipAmount)}${tipAmount > 0 ? ` · incl. ${formatCurrency(tipAmount)} tip` : ''}`;
    if (totalEl) totalEl.textContent = formatCurrency(grandTotal);
    if (dockCount) dockCount.textContent = String(itemCount);
    if (dockTotal) dockTotal.textContent = `₹${grandTotal.toFixed(0)}`;
    if (btnCheckout) btnCheckout.disabled = activeCart.length === 0;
  }

  function addToCart(item) {
    const existing = activeCart.find((cartItem) => cartItem.id === item.id);
    if (existing) existing.quantity += 1;
    else activeCart.push({ ...item, quantity: 1 });
    updateBillSummaryUI();
  }

  function openOrderDrawer(event) {
    if (!orderDrawer) return;
    lastOrderTrigger = event?.currentTarget || null;
    orderDrawer.hidden = false;
    document.body.classList.add('order-drawer-open');
    document.querySelectorAll('.js-view-order').forEach((button) => button.setAttribute('aria-expanded', 'true'));
    orderDrawerClose?.focus();
  }

  function closeOrderDrawer() {
    if (!orderDrawer) return;
    orderDrawer.hidden = true;
    document.body.classList.remove('order-drawer-open');
    document.querySelectorAll('.js-view-order').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    lastOrderTrigger?.focus();
    lastOrderTrigger = null;
  }

  document.querySelectorAll('.js-view-order').forEach((button) => button.addEventListener('click', openOrderDrawer));
  orderDrawerClose?.addEventListener('click', closeOrderDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && orderDrawer && !orderDrawer.hidden) closeOrderDrawer();
  });
  document.querySelectorAll('.js-dock-nav').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: 'smooth' }));
  });
  document.querySelector('.js-account')?.addEventListener('click', () => {
    if (!authService.user) {
      if (window.entryGatewayModal) {
        window.entryGatewayModal.renderModal(true);
      } else {
        authService.loginWithGoogle('Customer', window.location.href);
      }
    } else {
      document.getElementById('sentry-google-auth-widget')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      authService.showToast(`Signed in as ${authService.user.name} (${authService.user.role} Role)`);
    }
  });
  document.querySelector('.js-order-updates')?.addEventListener('click', (event) => {
    const phone = document.getElementById('cust-phone');
    if (!phone?.value.trim()) {
      phone?.focus();
      authService.showToast('Add a phone number to enable order updates.');
      return;
    }
    event.currentTarget.textContent = 'Updates Enabled ✓';
    authService.showToast('Order updates enabled for this ticket.');
  });

  if (searchInput) searchInput.addEventListener('input', renderMenu);

  if (tableSelect) {
    tableSelect.addEventListener('change', (event) => {
      const fullVal = event.target.value || 'Table 02';
      const cleanTableNo = fullVal.split(' · ')[0].trim();
      selectedTable = cleanTableNo;
      if (tableBadge) tableBadge.textContent = cleanTableNo;
      const receiptTableTag = document.querySelector('#receipt .pk');
      if (receiptTableTag) receiptTableTag.textContent = cleanTableNo.toUpperCase();
    });
  }

  document.querySelectorAll('.tip-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.tip-pill').forEach((item) => item.classList.remove('active'));
      pill.classList.add('active');
      selectedTipPct = Number(pill.dataset.tip) || 0;
      updateBillSummaryUI();
    });
  });

  const chipContainer = document.getElementById('quick-notes-chips');
  if (chipContainer && specialNotesInput) {
    chipContainer.querySelectorAll('.chip-note').forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.text || '';
        const current = specialNotesInput.value.trim();
        if (!current) specialNotesInput.value = text;
        else if (!current.includes(text)) specialNotesInput.value = `${current}, ${text}`;
      });
    });
  }

  // =========================================================================
  // VibeAthon SESSION ENGINE & TABLE BOOKING CONTROLS
  // =========================================================================
  const bookTableBtn = document.getElementById('btn-book-table-action');
  const tableMatrixContainer = document.getElementById('cust-table-matrix-container');
  const sessionStatusTag = document.getElementById('cust-session-status-tag');
  const sessionDetailsEl = document.getElementById('cust-session-details');
  const sessionHeaderChip = document.getElementById('cust-header-session-chip');

  let currentActiveSession = null;
  let waitTimerInterval = null;

  function renderTableMatrixUI() {
    if (!tableMatrixContainer) return;
    const tables = dbEngine.getTables();
    tableMatrixContainer.innerHTML = '';
    
    tables.forEach(t => {
      const isBooked = t.status === 'OCCUPIED' || t.status === 'BOOKED' || t.status === 'RESERVED';
      const isSelected = selectedTable === t.table_number;
      
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-sentry';
      btn.style.padding = '8px';
      btn.style.fontSize = '11px';
      btn.style.cursor = 'pointer';
      btn.style.border = isSelected ? '2px solid #ffffff' : '1px solid transparent';
      btn.style.boxShadow = isSelected ? '0 0 14px rgba(255,255,255,0.7)' : 'none';
      
      if (isBooked) {
        btn.style.background = 'var(--color-warning)';
        btn.style.color = '#fff';
        btn.innerHTML = `<i class="fa-solid fa-chair"></i> ${t.table_number.replace('Table ', 'T')}<br>BOOKED`;
        btn.onclick = () => {
          selectedTable = t.table_number;
          if (tableSelect) tableSelect.value = t.table_number;
          renderTableMatrixUI();
        };
      } else {
        btn.style.background = 'var(--color-accent-lime)';
        btn.style.color = '#000';
        btn.innerHTML = `<i class="fa-solid fa-chair"></i> ${t.table_number.replace('Table ', 'T')}<br>VACANT`;
        btn.onclick = () => {
          selectedTable = t.table_number;
          if (tableSelect) tableSelect.value = t.table_number;
          renderTableMatrixUI();
        };
      }
      
      tableMatrixContainer.appendChild(btn);
    });
  }

  window.addEventListener('storage', () => {
    refreshActiveSessionUI();
    renderTableMatrixUI();
  });

  window.addEventListener('rest_os_table_sync', () => {
    renderTableMatrixUI();
  });

  window.addEventListener('rest_os_session_sync', () => {
    refreshActiveSessionUI();
    renderTableMatrixUI();
  });

  setInterval(() => {
    renderTableMatrixUI();
    refreshActiveSessionUI();
  }, 1000);

  function refreshActiveSessionUI() {
    const currentUser = authService.user;
    const custId = currentUser?.email || currentUser?.id || 'CUST-8021';
    currentActiveSession = dbEngine.getActiveSessionForCustomer(custId);

    if (currentActiveSession) {
      if (sessionStatusTag) {
        sessionStatusTag.textContent = `STATUS: ACTIVE SESSION · ${currentActiveSession.session_id}`;
        sessionStatusTag.style.color = 'var(--color-accent-lime)';
      }
      if (sessionDetailsEl) {
        sessionDetailsEl.innerHTML = `
          <strong>Session ID:</strong> <span class="mono">${currentActiveSession.session_id}</span> (6-digit) &nbsp;·&nbsp;
          <strong>Table:</strong> ${currentActiveSession.table_no} &nbsp;·&nbsp;
          <strong>Waiter Allotted:</strong> ${currentActiveSession.waiter_id || '<span style="color:var(--color-warning);">WAITING FOR WAITER...</span>'} &nbsp;·&nbsp;
          <strong>Delivered:</strong> <span id="session-delivered-flag" style="color: ${currentActiveSession.delivered === 'Y' ? '#10b981' : '#f59e0b'}; font-weight: 700;">${currentActiveSession.delivered}</span>
          ${currentActiveSession.status === 'ACTIVE' ? `
            <button id="btn-generate-bill-customer" class="btn-sentry" style="margin-left: 12px; font-size: 11px; padding: 4px 8px;"><i class="fa-solid fa-file-invoice-dollar"></i> Generate Bill & Pay</button>
            <button id="btn-leave-session-customer" class="btn-ghost-sm" style="margin-left: 8px; font-size: 11px; padding: 4px 8px; color: var(--color-accent-pink); border-color: rgba(236,72,153,0.4);"><i class="fa-solid fa-right-from-bracket"></i> Leave Session</button>
          ` : `<span class="badge" style="margin-left: 12px; background: var(--color-warning); color: #000;">${currentActiveSession.status}</span>`}
        `;
        document.getElementById('btn-generate-bill-customer')?.addEventListener('click', () => {
           renderBillPaymentModal(currentActiveSession, null);
        });
        document.getElementById('btn-leave-session-customer')?.addEventListener('click', () => {
           if (confirm('End this dining session and leave your table? Table will become vacant.')) {
             dbEngine.clearActiveSession(custId);
             currentActiveSession = null;
             selectedTable = 'Table 01';
             refreshActiveSessionUI();
             authService.showToast('Session ended. Table is now VACANT.');
           }
        });
      }
      if (sessionHeaderChip) {
        sessionHeaderChip.textContent = `SESSION: ${currentActiveSession.session_id} · ${currentActiveSession.table_no}`;
      }
      if (!selectedTable) {
        selectedTable = currentActiveSession.table_no;
        if (tableSelect) tableSelect.value = selectedTable;
      }

      if (bookTableBtn) {
        bookTableBtn.disabled = true;
        bookTableBtn.style.opacity = '0.6';
        bookTableBtn.style.cursor = 'not-allowed';
        bookTableBtn.innerHTML = `<i class="fa-solid fa-lock"></i> TABLE BOOKED: ${currentActiveSession.table_no} (ACTIVE SESSION)`;
      }

      // Render Top Table Booking Notification Bar
      const appContainer = document.querySelector('.app-container');
      let bookingBar = document.getElementById('customer-top-booking-bar');
      if (!bookingBar && appContainer) {
        bookingBar = document.createElement('div');
        bookingBar.id = 'customer-top-booking-bar';
        appContainer.parentNode.insertBefore(bookingBar, appContainer);
      }
      if (bookingBar) {
        bookingBar.style.cssText = 'max-width: 1280px; margin: 16px auto 0; padding: 0 16px;';
        bookingBar.innerHTML = `
          <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(236, 72, 153, 0.25)); border: 1.5px solid var(--color-accent-lime); border-radius: var(--radius-xl); padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); animation: slideDown 0.3s ease;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="background: rgba(194, 239, 78, 0.2); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i class="fa-solid fa-calendar-check" style="color: var(--color-accent-lime); font-size: 20px;"></i>
              </div>
              <div>
                <h4 style="font-size: 15px; font-weight: 700; color: #fff; margin: 0 0 2px;">
                  🎉 Table Booked: <span style="color: var(--color-accent-lime); font-family: var(--font-mono);">${currentActiveSession.table_no}</span>
                </h4>
                <span style="font-size: 12px; color: var(--text-secondary);">
                  Session ID: <strong style="color: #fff; font-family: var(--font-mono);">${currentActiveSession.session_id}</strong> &nbsp;·&nbsp; Waiter Allotted: <strong style="color: var(--color-accent-pink);">${currentActiveSession.waiter_id || 'Waitstaff'}</strong> &nbsp;·&nbsp; Status: <span style="color: var(--color-accent-lime); font-weight: 700;">ACTIVE (READY FOR ORDERS)</span>
                </span>
              </div>
            </div>
            <button type="button" class="btn-sentry" onclick="this.closest('#customer-top-booking-bar').remove()" style="padding: 6px 12px; font-size: 11px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; cursor: pointer;">
              <i class="fa-solid fa-xmark"></i> Dismiss
            </button>
          </div>
        `;
      }
    } else {
      if (bookTableBtn) {
        bookTableBtn.disabled = false;
        bookTableBtn.style.opacity = '1';
        bookTableBtn.style.cursor = 'pointer';
        bookTableBtn.innerHTML = `<i class="fa-solid fa-chair"></i> BOOK TABLE & START SESSION`;
      }

      const bookingBar = document.getElementById('customer-top-booking-bar');
      if (bookingBar) bookingBar.remove();

      if (sessionStatusTag) {
        sessionStatusTag.textContent = 'STATUS: NO ACTIVE SESSION (READY TO BOOK)';
        sessionStatusTag.style.color = 'var(--text-secondary)';
      }
      if (sessionDetailsEl) {
        sessionDetailsEl.textContent = 'Select a table below to generate a 6-digit Session ID & allot Waiter ID.';
      }
      if (sessionHeaderChip) {
        sessionHeaderChip.textContent = 'NO ACTIVE SESSION';
      }
    }
    renderTableMatrixUI();
    updateLiveOrderTrackerUI();
  }

  // API Flow: Table booking try -> if not available (FULL) -> returns apology modal -> else generates 6-digit Session ID
  if (bookTableBtn) {
    bookTableBtn.addEventListener('click', () => {
      const currentUser = authService.user;
      const custId = currentUser?.email || currentUser?.id || 'CUST-8021';
      const custName = currentUser?.name || 'Customer';
      const prefTable = selectedTable || 'Table 03';

      const res = dbEngine.startSession(custId, custName, prefTable);

      if (!res.ok) {
        if (res.reason === 'ACTIVE_SESSION_EXISTS') {
          alert(`⚠️ ACTIVE TABLE BOOKING IN PROGRESS!\n\nYou already have ${res.session?.table_no} booked (Session ID: ${res.session?.session_id}).\n\nPlease leave your current table session before booking a new table.`);
          authService.showToast(res.message);
        } else {
          alert(`SORRY RESTAURANT FULL!\n\nAll tables are currently occupied. Please join our Virtual Queue to be notified when a table becomes vacant.`);
          authService.showToast('Sorry Restaurant FULL! Table booking unavailable.');
        }
        return;
      }

      currentActiveSession = res.session;
      authService.showToast(res.message);
      refreshActiveSessionUI();
      renderTableMatrixUI();
    });
  }

  // Poll for Served / Delivered (Y/N) & Waiter Allotment status updates
  setInterval(() => {
    if (!currentActiveSession) return;
    const session = dbEngine.getSessionById(currentActiveSession.session_id);
    if (!session) return;
    
    // Check if session was terminated by Waiter or Customer Payment
    if (!session || session.status === 'TERMINATED' || session.status === 'COMPLETED' || session.status === 'PAID') {
      currentActiveSession = null;
      localStorage.removeItem('rest_os_active_session');
      refreshActiveSessionUI();
      renderTableMatrixUI();
      authService.showToast('✅ Payment Verified! Session terminated & table is now VACANT.');
      return;
    }
    
    if (session.waiter_id !== currentActiveSession.waiter_id) {
      currentActiveSession = session;
      refreshActiveSessionUI();
      if (session.waiter_id) {
        authService.showToast(`🔔 Waiter Allotted: ${session.waiter_id}`);
      }
    }

    if (session.delivered !== currentActiveSession.delivered) {
      currentActiveSession = session;
      const flagEl = document.getElementById('session-delivered-flag');
      if (flagEl) {
        flagEl.textContent = session.delivered;
        flagEl.style.color = session.delivered === 'Y' ? '#10b981' : '#f59e0b';
      }
      if (session.delivered === 'Y') {
        authService.showToast('Order SERVED! Waiter & Kitchen confirmed delivery (DB Delivered = Y).');
      }
    }

    updateLiveOrderTrackerUI();
  }, 1500);

  function updateLiveOrderTrackerUI() {
    const badgeEl = document.getElementById('tracker-order-id-badge');
    const step1 = document.getElementById('chk-step-1');
    const step2 = document.getElementById('chk-step-2');
    const step3 = document.getElementById('chk-step-3');
    const step4 = document.getElementById('chk-step-4');

    if (!step1 || !step2 || !step3 || !step4) return;

    if (!currentActiveSession) {
      if (badgeEl) badgeEl.textContent = 'NO ORDER';
      resetTrackerSteps([step1, step2, step3, step4]);
      return;
    }

    const allOrders = dbEngine.getOrders();
    const activeOrder = allOrders.find(o => o.session_id === currentActiveSession.session_id && o.status !== 'TERMINATED');

    if (!activeOrder) {
      if (badgeEl) badgeEl.textContent = `SESS: ${currentActiveSession.session_id}`;
      resetTrackerSteps([step1, step2, step3, step4]);
      return;
    }

    if (badgeEl) badgeEl.textContent = activeOrder.order_number;

    const status = activeOrder.status;

    // 1) Order taken by waiter: NEW, ACCEPTED, SENT_TO_KITCHEN, PREPARING, READY, COLLECTED, DELIVERED, PAID
    const s1Done = ['NEW', 'ACCEPTED', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'COLLECTED', 'DELIVERED', 'PAID'].includes(status);
    
    // 2) Order send to kitchen: NEW, SENT_TO_KITCHEN, PREPARING, READY, COLLECTED, DELIVERED, PAID
    const s2Done = ['NEW', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'COLLECTED', 'DELIVERED', 'PAID'].includes(status);
    
    // 3) Order collected by waiter: PREPARING, READY, COLLECTED, DELIVERED, PAID
    const s3Done = ['PREPARING', 'READY', 'COLLECTED', 'DELIVERED', 'PAID'].includes(status) || activeOrder.delivered === 'Y';
    
    // 4) Order delivered to customer: READY, COLLECTED, DELIVERED, PAID or activeOrder.delivered === 'Y'
    const s4Done = ['READY', 'COLLECTED', 'DELIVERED', 'PAID'].includes(status) || activeOrder.delivered === 'Y';

    setTrackerStepState(step1, s1Done);
    setTrackerStepState(step2, s2Done);
    setTrackerStepState(step3, s3Done);
    setTrackerStepState(step4, s4Done);
  }

  function setTrackerStepState(stepEl, isDone) {
    if (!stepEl) return;
    const circle = stepEl.querySelector('.step-circle');
    const label = stepEl.querySelector('.step-label');

    if (isDone) {
      if (circle) {
        circle.style.border = '2px solid #10b981';
        circle.style.background = '#10b981';
        circle.style.color = '#000';
        circle.innerHTML = '<i class="fa-solid fa-check"></i>';
      }
      if (label) {
        label.style.color = '#10b981';
      }
    } else {
      if (circle) {
        circle.style.border = '2px solid #4b5563';
        circle.style.background = '#12131a';
        circle.style.color = '#4b5563';
        circle.innerHTML = '<i class="fa-solid fa-circle" style="font-size: 5px;"></i>';
      }
      if (label) {
        label.style.color = 'var(--text-tertiary)';
      }
    }
  }

  function resetTrackerSteps(steps) {
    steps.forEach(step => setTrackerStepState(step, false));
  }

  // Draggable Live Order Tracker Logic (Movable anywhere across screen)
  function initDraggableTracker() {
    const panel = document.getElementById('cust-order-tracker-panel');
    const header = document.getElementById('cust-order-tracker-header');
    const btnToggle = document.getElementById('btn-toggle-tracker');
    const body = document.getElementById('cust-order-tracker-body');

    if (!panel || !header) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    const siteHeader = document.querySelector('.customer-site-header');

    const positionTrackerBelowHeader = () => {
      if (panel.dataset.userPositioned === 'true') return;
      const headerHeight = siteHeader?.getBoundingClientRect().height || 0;
      panel.style.top = `${Math.max(12, Math.ceil(headerHeight + 12))}px`;
    };

    positionTrackerBelowHeader();
    window.addEventListener('resize', positionTrackerBelowHeader);

    const startDrag = (clientX, clientY) => {
      isDragging = true;
      startX = clientX;
      startY = clientY;
      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      header.style.cursor = 'grabbing';
      panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.85)';
    };

    const moveDrag = (clientX, clientY) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = window.innerWidth - panel.offsetWidth - 10;
      const maxTop = window.innerHeight - panel.offsetHeight - 10;

      newLeft = Math.max(10, Math.min(newLeft, maxLeft));
      newTop = Math.max(10, Math.min(newTop, maxTop));

      panel.dataset.userPositioned = 'true';
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };

    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
        panel.style.boxShadow = '0 12px 32px rgba(0,0,0,0.6)';
      }
    };

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', endDrag);

    header.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      moveDrag(touch.clientX, touch.clientY);
    }, { passive: true });

    document.addEventListener('touchend', endDrag);

    if (btnToggle && body) {
      const setTrackerCollapsed = (collapsed) => {
        body.style.display = collapsed ? 'none' : 'flex';
        btnToggle.setAttribute('aria-expanded', String(!collapsed));
        btnToggle.innerHTML = collapsed
          ? '<i class="fa-solid fa-chevron-down"></i>'
          : '<i class="fa-solid fa-chevron-up"></i>';
      };
      const compactViewport = window.matchMedia('(max-width: 1024px)');
      const syncCompactTrackerState = () => {
        if (!btnToggle.dataset.userToggled) setTrackerCollapsed(compactViewport.matches);
      };

      syncCompactTrackerState();
      if (typeof compactViewport.addEventListener === 'function') {
        compactViewport.addEventListener('change', syncCompactTrackerState);
      } else {
        compactViewport.addListener(syncCompactTrackerState);
      }

      btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        btnToggle.dataset.userToggled = 'true';
        setTrackerCollapsed(body.style.display !== 'none');
      });
    }
  }

  initDraggableTracker();

  // Timer countdown for estimated waiting time
  function startWaitingTimer(minutes = 15) {
    let secondsLeft = minutes * 60;
    if (waitTimerInterval) clearInterval(waitTimerInterval);

    waitTimerInterval = setInterval(() => {
      secondsLeft -= 1;
      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const timerEl = document.getElementById('cust-wait-timer');
      if (timerEl) timerEl.textContent = timeStr;

      if (secondsLeft <= 0) {
        clearInterval(waitTimerInterval);
        if (timerEl) timerEl.textContent = '00:00 (Order Served!)';
      }
    }, 1000);
  }

  // =========================================================================
  // CHECKOUT & BILL RECEIPT PAYMENT MODAL
  // =========================================================================
  btnCheckout?.addEventListener('click', () => {
    if (activeCart.length === 0) return;

    const currentUser = authService.user;
    const custId = currentUser?.email || currentUser?.id || 'CUST-8021';
    const custName = currentUser?.name || 'Customer';

    // Ensure an active session exists
    if (!currentActiveSession) {
      const startRes = dbEngine.startSession(custId, custName, selectedTable);
      if (!startRes.ok) {
        alert(`SORRY RESTAURANT FULL!\n\nAll tables are currently occupied.`);
        return;
      }
      currentActiveSession = startRes.session;
      refreshActiveSessionUI();
    }
    
    if (!currentActiveSession.waiter_id) {
      const wId = dbEngine.allotWaiter();
      if (wId) {
        currentActiveSession.waiter_id = wId;
        const allSess = dbEngine.getSessions();
        const idx = allSess.findIndex(s => s.session_id === currentActiveSession.session_id);
        if (idx !== -1) { allSess[idx].waiter_id = wId; dbEngine.saveSessions(allSess); }
      }
    }

    // Submit Order to active session
    const orderRes = dbEngine.createSessionOrder(
      currentActiveSession.session_id,
      [...activeCart],
      specialNotesInput?.value.trim() || ''
    );

    if (!orderRes.ok) {
      alert(orderRes.message);
      return;
    }

    // Start Server Estimated Waiting Time Timer (15 min)
    startWaitingTimer(15);
    authService.showToast('Order successfully sent to kitchen!');

    activeCart = [];
    updateBillSummaryUI();
    closeOrderDrawer();
  });

  function renderBillPaymentModal(session, order) {
    const existing = document.getElementById('cust-payment-bill-modal');
    if (existing) existing.remove();

    const formattedBillText = dbEngine.generateFormattedBillReceipt(session, 'UPI');

    const modalHtml = `
      <div id="cust-payment-bill-modal" class="entry-gateway-backdrop" style="z-index: 10000;">
        <div class="entry-modal-card" style="max-width: 680px; width: 95%;">
          <div class="entry-modal-header" style="text-align: left; border-bottom: 1px solid var(--border-violet); padding-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <span class="badge sandbox-badge" style="background: rgba(194, 239, 78, 0.15); color: var(--color-accent-lime); font-size: 11px;">
                  <i class="fa-solid fa-file-invoice"></i> SESSION BILL & RECEIPT
                </span>
                <h3 style="font-size: 22px; font-weight: 700; margin-top: 4px;">Session ID: ${session.session_id}</h3>
              </div>
              <button type="button" id="btn-close-bill-modal" style="background: none; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer;">×</button>
            </div>
          </div>

          <!-- Exact Bill Receipt Output Box -->
          <div style="background: #0d1117; border: 1px dashed var(--border-violet); border-radius: var(--radius-md); padding: 16px; margin: 16px 0; font-family: var(--font-mono); font-size: 12px; color: #a3e635; white-space: pre-wrap; max-height: 280px; overflow-y: auto;">
${formattedBillText}
          </div>

          <!-- Payment Options Selector -->
          <div style="margin-bottom: 20px;">
            <label style="font-size: 13px; font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 8px;">Select Payment Option:</label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
              <button type="button" class="btn-pay-type active" data-type="UPI" style="background: var(--color-primary); border: 2px solid var(--color-accent-lime); color: #fff; padding: 10px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;">
                <i class="fa-solid fa-mobile-screen-button"></i> 1) UPI (Stripe)
              </button>
              <button type="button" class="btn-pay-type" data-type="Card" style="background: var(--color-primary); border: 1px solid var(--border-violet); color: #fff; padding: 10px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;">
                <i class="fa-solid fa-credit-card"></i> 2) Card
              </button>
              <button type="button" class="btn-pay-type" data-type="Cash" style="background: var(--color-primary); border: 1px solid var(--border-violet); color: #fff; padding: 10px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;">
                <i class="fa-solid fa-money-bill-wave"></i> 3) Cash
              </button>
            </div>
            <p id="pay-type-notice" style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
              UPI selected: Soft copy bill & transaction receipt will be generated and shown to waiter post verification.
            </p>
          </div>

          <!-- Post Payment Session Action Buttons -->
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" id="btn-session-reorder" class="btn-ghost-sm" style="padding: 10px 16px;">
              <i class="fa-solid fa-rotate-right"></i> Option B: Reorder (Same Session)
            </button>
            <button type="button" id="btn-session-terminate" class="btn-sentry" style="padding: 10px 16px;">
              <i class="fa-solid fa-flag-checkered"></i> Option A: Terminate Session & Pay
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const billModal = document.getElementById('cust-payment-bill-modal');
    let selectedPayType = 'UPI';

    billModal.querySelectorAll('.btn-pay-type').forEach(btn => {
      btn.addEventListener('click', () => {
        billModal.querySelectorAll('.btn-pay-type').forEach(b => {
          b.style.borderColor = 'var(--border-violet)';
          b.classList.remove('active');
        });
        btn.style.borderColor = 'var(--color-accent-lime)';
        btn.classList.add('active');
        selectedPayType = btn.dataset.type;

        const noticeEl = document.getElementById('pay-type-notice');
        if (selectedPayType === 'Cash' || selectedPayType === 'Card') {
          noticeEl.textContent = `${selectedPayType} selected: Waiter ${session.waiter_id} will be notified to collect payment and provide hard copy bill.`;
        } else {
          noticeEl.textContent = 'UPI selected: Soft copy bill & transaction receipt generated for waiter verification.';
        }
      });
    });

    document.getElementById('btn-close-bill-modal')?.addEventListener('click', () => billModal.remove());

    // Option B: Reorder in same session
    document.getElementById('btn-session-reorder')?.addEventListener('click', () => {
      dbEngine.reorderInSession(session.session_id);
      authService.showToast(`Reorder mode active for Session ID ${session.session_id}. Choose dishes from menu.`);
      billModal.remove();
    });

    // Option A: Terminate Session -> Mark Table Vacant + Customer Feedback Popup
    document.getElementById('btn-session-terminate')?.addEventListener('click', () => {
      const sessions = dbEngine.getSessions();
      const targetSession = sessions.find(s => s.session_id === session.session_id);
      if (targetSession) {
        targetSession.status = 'PAYMENT_PENDING';
        targetSession.payment_type = selectedPayType;
        dbEngine.saveSessions(sessions);
        window.dispatchEvent(new Event('storage'));
      }
      
      billModal.remove();
      alert('Payment submitted! Waiting for Waiter verification...');
      renderFeedbackModal(session, selectedPayType);
    });
  }

  // Customer Feedback Modal (5 Sentiment Emojis + Max 50 Words Review)
  function renderFeedbackModal(session, paymentType) {
    const existing = document.getElementById('cust-feedback-modal');
    if (existing) existing.remove();

    const feedbackHtml = `
      <div id="cust-feedback-modal" class="entry-gateway-backdrop" style="z-index: 10001;">
        <div class="entry-modal-card" style="max-width: 520px; width: 95%; text-align: center;">
          <div style="font-size: 32px; color: var(--color-accent-lime); margin-bottom: 8px;">
            <i class="fa-solid fa-heart-circle-check"></i>
          </div>
          <h3 style="font-size: 22px; font-weight: 700;">Customer Feedback</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 20px;">
            Session ${session.session_id} is being terminated. Please rate your dining experience!
          </p>

          <!-- 5 Sentiment Emojis -->
          <div id="emoji-rating-bar" style="display: flex; justify-content: center; gap: 16px; font-size: 36px; margin-bottom: 20px; cursor: pointer;">
            <span class="emoji-opt" data-rating="1" title="Terrible">😡</span>
            <span class="emoji-opt" data-rating="2" title="Poor">🙁</span>
            <span class="emoji-opt" data-rating="3" title="Average">😐</span>
            <span class="emoji-opt" data-rating="4" title="Good">😊</span>
            <span class="emoji-opt active" data-rating="5" title="Excellent" style="transform: scale(1.2);">😍</span>
          </div>

          <textarea id="cust-review-text" placeholder="Write a short review (max 50 words)..." rows="3" style="width: 100%; background: var(--color-primary); border: 1px solid var(--border-violet); color: #fff; padding: 12px; border-radius: var(--radius-md); font-size: 13px; margin-bottom: 20px;"></textarea>

          <button type="button" id="btn-submit-feedback-terminate" class="btn-sentry" style="width: 100%; padding: 12px;">
            Submit Feedback & Terminate Session <i class="fa-solid fa-check"></i>
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', feedbackHtml);

    const fbModal = document.getElementById('cust-feedback-modal');
    let selectedRating = 5;

    fbModal.querySelectorAll('.emoji-opt').forEach(emoji => {
      emoji.addEventListener('click', () => {
        fbModal.querySelectorAll('.emoji-opt').forEach(e => e.style.transform = 'scale(1)');
        emoji.style.transform = 'scale(1.25)';
        selectedRating = Number(emoji.dataset.rating) || 5;
      });
    });

    document.getElementById('btn-submit-feedback-terminate')?.addEventListener('click', () => {
      const reviewText = document.getElementById('cust-review-text')?.value || '';
      const feedbackObj = { rating: selectedRating, reviewText };

      // Save feedback locally, Waiter will terminate the session upon payment receipt
      const sessions = dbEngine.getSessions();
      const targetSession = sessions.find(s => s.session_id === session.session_id);
      if (targetSession) {
         targetSession.feedback = feedbackObj;
         dbEngine.saveSessions(sessions);
      }
      
      authService.showToast('Feedback submitted! Waiter is verifying payment.');
      fbModal.remove();
      refreshActiveSessionUI();
    });
  }

  // Smooth Header Navigation & ScrollSpy
  function initHeaderNavigation() {
    const navLinks = document.querySelectorAll('nav.main a');
    if (!navLinks.length) return;

    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (!targetId || targetId.includes('index.html')) return; // Allow normal navigation to landing page
        e.preventDefault();

        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        if (targetId === '#account') {
          if (!authService.user) {
            if (window.entryGatewayModal) {
              window.entryGatewayModal.renderModal(true);
            } else {
              authService.loginWithGoogle('Customer', window.location.href);
            }
          } else {
            const authWidget = document.getElementById('sentry-google-auth-widget');
            if (authWidget) {
              authWidget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            authService.showToast(`Signed in as ${authService.user.name} (${authService.user.role} Role)`);
          }
          return;
        }

        if (targetId === '#order') {
          const trackerPanel = document.getElementById('cust-order-tracker-panel');
          if (trackerPanel) {
            trackerPanel.style.display = 'block';
            trackerPanel.style.boxShadow = '0 0 0 4px var(--color-accent-lime), 0 16px 40px rgba(0,0,0,0.8)';
            setTimeout(() => {
              trackerPanel.style.boxShadow = '0 12px 32px rgba(0,0,0,0.6)';
            }, 1500);
          }
        }

        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          const headerOffset = 90;
          const elementPosition = targetEl.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      });
    });

    // ScrollSpy: Automatically highlight active section on scroll
    const sections = [
      { id: '#menu', el: document.querySelector('#menu') },
      { id: '#regulars', el: document.querySelector('#regulars') },
      { id: '#pairings', el: document.querySelector('#pairings') },
      { id: '#order', el: document.querySelector('#order') },
      { id: '#catering', el: document.querySelector('#catering') }
    ].filter(s => s.el);

    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY + 120;
      for (let i = sections.length - 1; i >= 0; i--) {
        if (scrollPos >= sections[i].el.offsetTop) {
          navLinks.forEach(l => l.classList.remove('active'));
          const activeLink = document.querySelector(`nav.main a[href="${sections[i].id}"]`);
          if (activeLink) activeLink.classList.add('active');
          break;
        }
      }
    }, { passive: true });
  }

  initHeaderNavigation();
  menuData = menuService.loadMenu() || { categories: [], items: [] };
  renderCategories();
  renderMenu();
  renderFavoriteButtons();
  refreshActiveSessionUI();
  updateBillSummaryUI();
});

