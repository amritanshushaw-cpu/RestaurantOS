/**
 * RestaurantOS - Kitchen Display System (KDS) Controller (100% Dynamic Input & State Mutation)
 */

import { dbEngine } from '../services/supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const ticketsContainer = document.getElementById('kds-tickets-container');

  // Kitchen Presence Polling
  const currentUser = JSON.parse(localStorage.getItem('rest_os_google_user'));
  if (currentUser) {
    dbEngine.registerStaffPresence(currentUser.id, currentUser.name, 'Kitchen');
  }
  setInterval(() => {
    if (currentUser) {
      dbEngine.registerStaffPresence(currentUser.id, currentUser.name, 'Kitchen');
    }
  }, 5000);

  // Inject Waiter Interface Notifications Feed Panel if not present
  let waiterFeedContainer = document.getElementById('waiter-notifications-feed');
  if (!waiterFeedContainer && ticketsContainer) {
    const feedSection = document.createElement('section');
    feedSection.style.cssText = 'background: var(--color-ink-deep); border: 1px solid var(--border-violet); border-radius: var(--radius-xl); padding: 20px; margin-bottom: 24px; text-align: left;';
    feedSection.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid var(--border-violet); padding-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-concierge-bell" style="color: var(--color-accent-pink); font-size: 18px;"></i>
          <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">Waiter Interface & Live Alerts Feed</h3>
        </div>
        <span class="badge sandbox-badge" style="font-size: 11px; background: rgba(236, 72, 153, 0.15); color: #ec4899;">LIVE WAITER MODE</span>
      </div>
      <div id="waiter-feed-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 140px; overflow-y: auto; font-size: 13px; color: var(--text-secondary);">
        <p style="margin: 0; color: var(--text-tertiary);">Listening for table bookings, order dispatches, and payment type alerts...</p>
      </div>
    `;
    ticketsContainer.parentNode.insertBefore(feedSection, ticketsContainer);
    waiterFeedContainer = document.getElementById('waiter-feed-list');
  }

  function updateWaiterFeed() {
    const feedList = document.getElementById('waiter-feed-list');
    if (!feedList) return;

    const sessions = dbEngine.getSessions();
    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');

    if (activeSessions.length === 0) {
      feedList.innerHTML = '<p style="margin: 0; color: var(--text-tertiary);">No active waiter sessions. Table booking notifications will appear here live.</p>';
      return;
    }

    feedList.innerHTML = activeSessions.map(s => `
      <div style="background: var(--color-primary); border: 1px solid var(--border-violet); border-radius: var(--radius-md); padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div>
          <strong style="color: var(--color-accent-lime); font-family: var(--font-mono);">[NOTIFICATION] Table Booked:</strong> ${s.table_no} &nbsp;·&nbsp;
          <strong>Session ID:</strong> <span class="mono" style="color: #fff;">${s.session_id}</span> &nbsp;·&nbsp;
          <strong>Waiter Allotted:</strong> ${s.waiter_id}
        </div>
        <span class="badge" style="font-size: 10px; background: rgba(194, 239, 78, 0.15); color: var(--color-accent-lime);">Delivered: ${s.delivered || 'N'}</span>
      </div>
    `).join('');
  }

  // Poll & Render Dynamic Tickets
  function refreshKDSTickets() {
    updateWaiterFeed();
    const allOrders = dbEngine.getOrders();
    // Kitchen only sees SENT_TO_KITCHEN and PREPARING orders
    const activeOrders = allOrders.filter(o => o.status === 'SENT_TO_KITCHEN' || o.status === 'PREPARING');

    if (activeOrders.length === 0) {
      ticketsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); margin-top: 60px;">
          <i class="fa-solid fa-utensils" style="font-size: 36px; margin-bottom: 12px;"></i>
          <p>No active kitchen orders. Wait for a Waiter to ACCEPT an order!</p>
        </div>
      `;
      return;
    }

    ticketsContainer.innerHTML = '';

    activeOrders.forEach(order => {
      const card = document.createElement('div');
      const statusClass = order.status.toLowerCase();
      card.className = `ticket-card ${statusClass}`;

      let actionBtnText = 'DONE (Order Ready)';
      let nextStatus = 'READY';
      let btnBg = 'var(--color-success)';

      const itemsListHTML = order.items.map(item => `
        <li class="ticket-item">
          <span><span class="kds-item-qty-badge">${item.quantity}x</span> ${item.name || item.item_name}</span>
          <i class="fa-regular fa-circle"></i>
        </li>
      `).join('');

      const cookingNotesHTML = order.special_instructions ? `
        <div class="kds-cooking-instructions">
          <i class="fa-solid fa-utensils"></i>
          <div>
            <strong style="color: var(--color-warning); text-transform: uppercase; letter-spacing: 0.3px;">Chef Note:</strong> ${order.special_instructions}
          </div>
        </div>
      ` : '';

      card.innerHTML = `
        <div>
          <div class="ticket-header">
            <div>
              <strong style="font-size: 16px;">${order.order_number}</strong>
              <span class="badge sandbox-badge" style="margin-left: 8px;">${order.table_number || order.table_id || 'Table 01'}</span>
              ${order.session_id ? `<span class="badge" style="font-family: var(--font-mono); margin-left: 6px; background: rgba(16, 185, 129, 0.15); color: #10b981;">Sess: ${order.session_id}</span>` : ''}
            </div>
            <span class="badge" style="font-size: 11px; font-weight: 700; background: rgba(194, 239, 78, 0.15); color: var(--color-accent-lime);">${order.status}</span>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
            <strong>Waiter:</strong> ${order.waiter_id || 'WAIT-01'} &nbsp;·&nbsp;
            <strong>Customer:</strong> <span style="color: var(--color-accent-lime);">${order.customer_name || 'Guest'}</span><br/>
            <strong>Chef:</strong> ${order.chef_id || 'Pending...'} &nbsp;·&nbsp;
            <strong>Delivered Status:</strong> <span style="font-weight: 700; color: ${order.delivered === 'Y' ? '#10b981' : '#f59e0b'};">${order.delivered || 'N'}</span>
          </div>

          ${cookingNotesHTML}

          <ul class="ticket-items">
            ${itemsListHTML}
          </ul>
        </div>

        <button class="pay-btn btn-progress-ticket" style="background: ${btnBg}; color: #000; padding: 10px; font-size: 13px; margin-top: 12px;">
          ${actionBtnText} <i class="fa-solid fa-arrow-right"></i>
        </button>
      `;

      card.querySelector('.btn-progress-ticket').addEventListener('click', () => {
        const allOrdersNow = dbEngine.getOrders();
        const target = allOrdersNow.find(x => x.id === order.id);
        if (target) {
          target.status = 'READY';
          localStorage.setItem('rest_os_orders', JSON.stringify(allOrdersNow));
          window.dispatchEvent(new Event('storage'));
          refreshKDSTickets();
        }
      });

      ticketsContainer.appendChild(card);
    });
  }

  // Poll state every 2 seconds & on storage events
  window.addEventListener('storage', refreshKDSTickets);
  setInterval(refreshKDSTickets, 2000);
  refreshKDSTickets();
});
