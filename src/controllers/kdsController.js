/**
 * RestaurantOS - Kitchen Display System (KDS) Controller (100% Dynamic Input & State Mutation)
 */

import { dbEngine } from '../services/supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const ticketsContainer = document.getElementById('kds-tickets-container');

  // Poll & Render Dynamic Tickets
  function refreshKDSTickets() {
    const allOrders = dbEngine.getOrders();
    const activeOrders = allOrders.filter(o => o.status !== 'PAID' && o.status !== 'CANCELLED');

    if (activeOrders.length === 0) {
      ticketsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); margin-top: 60px;">
          <i class="fa-solid fa-utensils" style="font-size: 36px; margin-bottom: 12px;"></i>
          <p>No active kitchen orders. Place an order from the POS Terminal or Customer Payment page to see live tickets appear here!</p>
        </div>
      `;
      return;
    }

    ticketsContainer.innerHTML = '';

    activeOrders.forEach(order => {
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
            </div>
            <span class="badge" style="font-size: 11px; font-weight: 700; background: rgba(194, 239, 78, 0.15); color: var(--color-accent-lime);">${order.status}</span>
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
        dbEngine.updateOrderStatus(order.id, nextStatus);
        refreshKDSTickets();
      });

      ticketsContainer.appendChild(card);
    });
  }

  // Poll state every 2 seconds
  setInterval(refreshKDSTickets, 2000);
  refreshKDSTickets();
});
