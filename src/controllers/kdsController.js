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
  let activeFilterTab = 'ACTIVE'; // 'ACTIVE' or 'HISTORY'

  // Add KDS Filter Tabs UI if not present
  const header = document.querySelector('.app-header');
  if (header && !document.getElementById('kds-filter-bar')) {
    const filterBar = document.createElement('div');
    filterBar.id = 'kds-filter-bar';
    filterBar.style.cssText = 'display: flex; gap: 10px; margin-top: 14px;';
    filterBar.innerHTML = `
      <button id="btn-kds-filter-active" class="btn-sentry active" style="padding: 8px 16px; font-size: 12px; font-weight: 700;">
        <i class="fa-solid fa-fire"></i> Active Kitchen Orders
      </button>
      <button id="btn-kds-filter-history" class="btn-ghost-sm" style="padding: 8px 16px; font-size: 12px; font-weight: 700; color: var(--text-secondary);">
        <i class="fa-solid fa-clock-rotate-left"></i> Completed History
      </button>
    `;
    header.appendChild(filterBar);

    document.getElementById('btn-kds-filter-active')?.addEventListener('click', () => {
      activeFilterTab = 'ACTIVE';
      document.getElementById('btn-kds-filter-active').className = 'btn-sentry active';
      document.getElementById('btn-kds-filter-history').className = 'btn-ghost-sm';
      refreshKDSTickets();
    });

    document.getElementById('btn-kds-filter-history')?.addEventListener('click', () => {
      activeFilterTab = 'HISTORY';
      document.getElementById('btn-kds-filter-history').className = 'btn-sentry active';
      document.getElementById('btn-kds-filter-active').className = 'btn-ghost-sm';
      refreshKDSTickets();
    });
  }

  function refreshKDSTickets() {
    updateWaiterFeed();
    const allOrders = dbEngine.getOrders();
    
    let displayOrders = [];
    if (activeFilterTab === 'ACTIVE') {
      displayOrders = allOrders.filter(o => 
        (o.status === 'NEW' || 
        o.status === 'PENDING' || 
        o.status === 'SENT_TO_KITCHEN' || 
        o.status === 'PREPARING' ||
        o.status === 'READY') &&
        o.delivered !== 'Y'
      );
    } else {
      displayOrders = allOrders.filter(o => 
        o.status === 'COMPLETED' || 
        o.status === 'PAID' || 
        o.status === 'DELIVERED' ||
        o.status === 'TERMINATED' ||
        o.delivered === 'Y'
      );
    }

    if (displayOrders.length === 0) {
      ticketsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); margin-top: 60px;">
          <i class="fa-solid fa-utensils" style="font-size: 36px; margin-bottom: 12px; color: var(--color-accent-pink);"></i>
          <p style="font-size: 15px; font-weight: 600;">${activeFilterTab === 'ACTIVE' ? 'No active kitchen orders right now.' : 'No completed order history found.'}</p>
          <p style="font-size: 13px; color: var(--text-tertiary);">Orders placed by Customers or Waiters will appear here instantly!</p>
        </div>
      `;
      return;
    }

    ticketsContainer.innerHTML = '';

    displayOrders.forEach(order => {
      const card = document.createElement('div');
      const statusClass = order.status.toLowerCase();
      card.className = `ticket-card ${statusClass}`;

      let actionBtnText = 'Accept & Start Cooking';
      let nextStatus = 'PREPARING';
      let btnBg = '#3b82f6';
      let btnColor = '#fff';

      if (order.status === 'PREPARING') {
        actionBtnText = 'Mark Completed (Order Ready)';
        nextStatus = 'READY';
        btnBg = 'var(--color-success)';
        btnColor = '#000';
      } else if (order.status === 'READY') {
        actionBtnText = 'Order Ready (Awaiting Delivery)';
        nextStatus = 'READY';
        btnBg = 'rgba(16, 185, 129, 0.2)';
        btnColor = '#10b981';
      } else if (['COMPLETED', 'PAID', 'DELIVERED'].includes(order.status)) {
        actionBtnText = 'Order Completed & Served';
        nextStatus = order.status;
        btnBg = 'rgba(255, 255, 255, 0.05)';
        btnColor = 'var(--text-tertiary)';
      }

      const itemsListHTML = (order.items || []).map(item => `
        <li class="ticket-item" style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom: 1px dashed rgba(255,255,255,0.08);">
          <span><span class="kds-item-qty-badge" style="background: var(--color-accent-pink); color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-right: 6px;">${item.quantity}x</span> ${item.name || item.item_name}</span>
          <i class="fa-regular fa-circle-check" style="color: var(--text-tertiary);"></i>
        </li>
      `).join('');

      const cookingNotesHTML = order.special_instructions ? `
        <div class="kds-cooking-instructions" style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 13px;">
          <i class="fa-solid fa-utensils" style="color: #f59e0b; margin-right: 6px;"></i>
          <strong style="color: #f59e0b; text-transform: uppercase; letter-spacing: 0.3px;">Chef Note:</strong> ${order.special_instructions}
        </div>
      ` : '';

      const formattedTime = order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

      card.innerHTML = `
        <div>
          <div class="ticket-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-violet); padding-bottom: 10px; margin-bottom: 10px;">
            <div>
              <strong style="font-size: 16px; color: var(--color-accent-lime);">${order.order_number}</strong>
              <span class="badge sandbox-badge" style="margin-left: 8px; background: rgba(236, 72, 153, 0.2); color: #ec4899;">${order.table_number || order.table_id || 'Table 01'}</span>
              ${order.session_id ? `<span class="badge" style="font-family: var(--font-mono); margin-left: 6px; background: rgba(16, 185, 129, 0.15); color: #10b981;">Sess: ${order.session_id}</span>` : ''}
            </div>
            <span class="badge" style="font-size: 11px; font-weight: 700; background: rgba(194, 239, 78, 0.15); color: var(--color-accent-lime);">${order.status}</span>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.6;">
            <strong>Customer:</strong> <span style="color: var(--color-accent-lime); font-weight:600;">${order.customer_name || 'Guest'}</span> &nbsp;·&nbsp;
            <strong>Waiter:</strong> <span style="color:#ec4899; font-weight:700;">${order.waiter_id || 'WAIT-01'}</span><br/>
            <strong>Time:</strong> <span style="color:#fff;">${formattedTime}</span> &nbsp;·&nbsp;
            <strong>Delivered Status:</strong> <span style="font-weight: 700; color: ${order.delivered === 'Y' ? '#10b981' : '#f59e0b'};">${order.delivered || 'N'}</span>
          </div>

          ${cookingNotesHTML}

          <ul class="ticket-items" style="list-style:none; padding:0; margin: 12px 0;">
            ${itemsListHTML}
          </ul>
        </div>

        <button class="pay-btn btn-progress-ticket" style="background: ${btnBg}; color: ${btnColor}; padding: 10px; font-size: 13px; font-weight: 700; margin-top: 12px; border-radius: var(--radius-sm); border: none; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>${actionBtnText}</span> <i class="fa-solid fa-arrow-right"></i>
        </button>
      `;

      card.querySelector('.btn-progress-ticket').addEventListener('click', () => {
        const updated = dbEngine.updateOrderStatus(order.id, nextStatus);
        if (updated && nextStatus === 'PREPARING' && currentUser) {
          updated.chef_id = currentUser.id;
        }
        if (nextStatus === 'READY') {
          authService.showToast(`🔔 Kitchen completed Order ${order.order_number}! Alert dispatched to Waiter.`);
        }
        refreshKDSTickets();
        window.dispatchEvent(new Event('storage'));
      });

      ticketsContainer.appendChild(card);
    });
  }

  // Poll state every 2 seconds & on storage events
  window.addEventListener('storage', refreshKDSTickets);
  setInterval(refreshKDSTickets, 2000);
  refreshKDSTickets();
});
