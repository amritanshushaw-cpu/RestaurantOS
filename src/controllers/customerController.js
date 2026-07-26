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
    const customerPicks = ['Garlic Butter Naan', 'Mango Lassi', 'Wagyu Beef Sliders']
      .map((name) => menuData.items.find((item) => item.name === name))
      .filter(Boolean);

    return [
      ...categories.map((category, index) => ({
        ...category,
        className: category.id === 'cat-03' ? 'darkcat' : '',
        status: index === 0 ? 'READY NOW' : index === 1 ? "CHEF'S BOARD" : category.id === 'cat-03' ? 'FROM THE BAR' : category.id === 'cat-04' ? 'SWEET FINISH' : '',
        description: category.id === 'cat-01'
          ? 'Small plates, bright chutneys, first bites.'
          : category.id === 'cat-02'
            ? 'Comfort plates, bold grills, slow-cooked favorites.'
            : category.id === 'cat-05'
              ? 'Slow spices, warm breads, family recipes.'
              : category.id === 'cat-03'
                ? 'Chilled, spiced, sparkling, poured to order.'
                : 'Warm, syrupy, creamy — choose your last bite.'
      })),
      {
        id: 'CUSTOMER_PICKS',
        name: 'Customer Picks',
        className: 'butcat',
        status: '',
        description: 'Easy add-ons for every order.',
        items: customerPicks,
        virtual: true
      }
    ];
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
        renderMenu();
      });
    });
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

      items.forEach((item, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'row menu-order-row';
        row.dataset.itemId = item.id;
        row.setAttribute('aria-label', `Add ${item.name} to order`);

        const tag = index % 3 === 0 ? 'V' : index % 3 === 1 ? 'D' : '';
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

  function openOrderDrawer() {
    if (!orderDrawer) return;
    orderDrawer.hidden = false;
    orderDrawerClose?.focus();
  }

  function closeOrderDrawer() {
    if (!orderDrawer) return;
    orderDrawer.hidden = true;
  }

  document.querySelectorAll('.js-view-order').forEach((button) => button.addEventListener('click', openOrderDrawer));
  orderDrawerClose?.addEventListener('click', closeOrderDrawer);
  document.querySelectorAll('.js-dock-nav').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: 'smooth' }));
  });
  document.querySelector('.js-account')?.addEventListener('click', () => {
    if (!authService.user) {
      authService.loginWithGoogle();
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
      selectedTable = event.target.value;
      if (tableBadge) tableBadge.textContent = selectedTable.replace(' · ', ' ');
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

  btnCheckout?.addEventListener('click', () => {
    if (activeCart.length === 0) return;

    btnCheckout.disabled = true;
    btnCheckout.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating order bill...';
    const totals = menuService.calculateOrderTotals(activeCart);
    const subtotal = Number(totals.subtotal);
    const tax = Number(totals.tax);
    const tipAmount = Number(((subtotal * selectedTipPct) / 100).toFixed(2));
    const grandTotal = (subtotal + tax + tipAmount).toFixed(2);
    const currentUser = authService.user;

    const newOrder = dbEngine.createOrder({
      table_id: selectedTable,
      table_number: selectedTable,
      customer_name: currentUser?.name || 'Customer',
      customer_email: currentUser?.email || 'guest@restaurantos.demo',
      items: [...activeCart],
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      tip: tipAmount.toFixed(2),
      total: grandTotal,
      special_instructions: specialNotesInput?.value.trim() || '',
      status: 'NEW'
    });

    setTimeout(() => {
      window.location.href = `payment.html?orderId=${newOrder.id}&total=${grandTotal}`;
    }, 600);
  });

  menuData = menuService.loadMenu() || { categories: [], items: [] };
  renderCategories();
  renderMenu();
  renderFavoriteButtons();
  updateBillSummaryUI();
});
