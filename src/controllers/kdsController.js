/**
 * RestaurantOS - Kitchen Display System (KDS) Controller Logic
 * Fetches active kitchen tickets, renders live order cards, and updates preparation status.
 */

import { dbClient } from '../services/supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const ticketsContainer = document.getElementById('kds-tickets-container');

  // Initial Mock Sample Kitchen Ticket if empty
  dbClient.getKitchenOrders().then(orders => {
    if (orders.length === 0) {
      dbClient.createOrder({
        table_number: 'Table 08',
        status: 'NEW',
        items: [
          { name: 'Wagyu Beef Sliders', quantity: 2 },
          { name: 'Truffle Fries & Aioli', quantity: 1 },
          { name: 'Signature Craft Cocktails', quantity: 2 }
        ],
        total: '96.00'
      }).then(() => refreshKDSTickets());
    } else {
      refreshKDSTickets();
    }
  });

  // Periodically Poll Kitchen Orders every 4 seconds
  setInterval(refreshKDSTickets, 4000);

  // Refresh Tickets UI
  async function refreshKDSTickets() {
    const orders = await dbClient.getKitchenOrders();

    if (orders.length === 0) {
      ticketsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); margin-top: 60px;">
          <i class="fa-solid fa-utensils" style="font-size: 36px; margin-bottom: 12px;"></i>
          <p>No active kitchen orders. New orders will appear here automatically.</p>
        </div>
      `;
      return;
    }

    ticketsContainer.innerHTML = '';

    orders.forEach(order => {
      const card = document.createElement('div');
      const statusClass = order.status.toLowerCase();
      card.className = `ticket-card ${statusClass}`;

      let actionBtnText = 'Start Preparing';
      let nextStatus = 'PREPARING';
      let btnBg = 'var(--accent-amber)';

      if (order.status === 'PREPARING') {
        actionBtnText = 'Mark as Ready';
        nextStatus = 'READY';
        btnBg = '#3b82f6';
      } else if (order.status === 'READY') {
        actionBtnText = 'Complete / Served';
        nextStatus = 'PAID';
        btnBg = 'var(--color-success)';
      }

      const itemsListHTML = order.items.map(item => `
        <li class="ticket-item">
          <span>${item.quantity}x ${item.name || item.item_name}</span>
          <i class="fa-regular fa-circle"></i>
        </li>
      `).join('');

      card.innerHTML = `
        <div>
          <div class="ticket-header">
            <div>
              <strong style="font-size: 16px;">${order.order_number}</strong>
              <span class="badge sandbox-badge" style="margin-left: 8px;">${order.table_number || 'Takeaway'}</span>
            </div>
            <span style="font-size: 11px; font-weight: 700; color: var(--accent-amber);">${order.status}</span>
          </div>

          <ul class="ticket-items">
            ${itemsListHTML}
          </ul>
        </div>

        <button class="pay-btn btn-progress-ticket" style="background: ${btnBg}; color: #000; padding: 10px; font-size: 13px;">
          ${actionBtnText} <i class="fa-solid fa-arrow-right"></i>
        </button>
      `;

      card.querySelector('.btn-progress-ticket').addEventListener('click', () => {
        order.status = nextStatus;
        refreshKDSTickets();
      });

      ticketsContainer.appendChild(card);
    });
  }
});
