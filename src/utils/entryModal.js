/**
 * RestaurantOS - Initial Full-Screen Blurred Backdrop Entry Gateway Modal
 * Displays a glassmorphic blurred backdrop modal with "Sign in as a Customer" and "Sign in as a Staff" options.
 */

import { authService } from '../services/authService.js';

class EntryGatewayModal {
  constructor() {
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.checkAndShowModal());
    } else {
      this.checkAndShowModal();
    }
  }

  checkAndShowModal() {
    // Show entry modal on landing page (index.html) or if force parameter present
    const path = window.location.pathname;
    const isLanding = path.endsWith('index.html') || path.endsWith('/') || path === '';

    if (isLanding && !sessionStorage.getItem('rest_os_gateway_dismissed')) {
      this.renderModal();
    }
  }

  renderModal() {
    const existing = document.getElementById('entry-gateway-modal');
    if (existing) existing.remove();

    const isSubdir = window.location.pathname.includes('/views/');
    const prefix = isSubdir ? '' : 'src/views/';

    const modalHtml = `
      <div id="entry-gateway-modal" class="entry-gateway-backdrop">
        <div class="entry-modal-card">
          <div class="entry-modal-header">
            <div class="entry-brand-logo">
              <i class="fa-solid fa-utensils"></i>
            </div>
            <h2 class="entry-modal-title">Welcome to Restaurant<span class="brand-highlight">OS</span></h2>
            <p class="entry-modal-subtitle">Please choose how you would like to enter the application</p>
          </div>

          <div class="entry-options-grid" style="grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <!-- Option 1: Customer Space -->
            <button type="button" id="btn-entry-customer" class="entry-option-card card-cust-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-lime"><i class="fa-solid fa-user"></i> Customer</span>
                <span class="entry-tag">Dining UI</span>
              </div>
              <div class="entry-option-icon icon-lime">
                <i class="fa-solid fa-utensils"></i>
              </div>
              <h3 class="entry-option-title">Customer Mode</h3>
              <p class="entry-option-desc">Dynamic menu card, 6-digit session ID generation, table booking & live order bill.</p>
              <div class="entry-action-link btn-lime-action">
                <span>Enter Dining</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>

            <!-- Option 2: Waiter Space -->
            <button type="button" id="btn-entry-waiter" class="entry-option-card card-staff-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-pink" style="background: rgba(236,72,153,0.15); color: #ec4899;"><i class="fa-solid fa-concierge-bell"></i> Waiter</span>
                <span class="entry-tag">Waiter UI</span>
              </div>
              <div class="entry-option-icon icon-violet" style="background: rgba(236,72,153,0.15); color: #ec4899;">
                <i class="fa-solid fa-concierge-bell"></i>
              </div>
              <h3 class="entry-option-title">Waiter Mode</h3>
              <p class="entry-option-desc">Live table booking alerts, order notifications & payment type (Cash/Card/UPI) alerts.</p>
              <div class="entry-action-link btn-violet-action" style="background: #ec4899; color: #000;">
                <span>Waiter Mode</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>

            <!-- Option 3: Kitchen Staff Space -->
            <button type="button" id="btn-entry-kitchen" class="entry-option-card card-staff-option">
              <div class="entry-card-top">
                <span class="entry-badge" style="background: rgba(59,130,246,0.15); color: #3b82f6;"><i class="fa-solid fa-fire"></i> Kitchen</span>
                <span class="entry-tag">KDS Prep</span>
              </div>
              <div class="entry-option-icon" style="background: rgba(59,130,246,0.15); color: #3b82f6;">
                <i class="fa-solid fa-fire"></i>
              </div>
              <h3 class="entry-option-title">Kitchen Mode</h3>
              <p class="entry-option-desc">Kitchen Display System (KDS), cooking notes, order status & Mark as Served (Delivered: Y).</p>
              <div class="entry-action-link" style="background: #3b82f6; color: #fff;">
                <span>Kitchen Mode</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>

            <!-- Option 4: Owner / Manager Space -->
            <button type="button" id="btn-entry-staff" class="entry-option-card card-staff-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-violet"><i class="fa-solid fa-user-shield"></i> Manager</span>
                <span class="entry-tag">Admin UI</span>
              </div>
              <div class="entry-option-icon icon-violet">
                <i class="fa-solid fa-chart-line"></i>
              </div>
              <h3 class="entry-option-title">Manager Mode</h3>
              <p class="entry-option-desc">Post-admin auth data tables (Main Data, Table Vacancy, Customer History) & BI revenue dashboard.</p>
              <div class="entry-action-link btn-violet-action">
                <span>Manager BI</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>
          </div>

          <div class="entry-modal-footer">
            <button type="button" id="btn-browse-landing" class="btn-ghost-sm">
              <i class="fa-solid fa-eye"></i> Browse Overview Landing Page First
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('entry-gateway-modal');
    const btnCustomer = document.getElementById('btn-entry-customer');
    const btnWaiter = document.getElementById('btn-entry-waiter');
    const btnKitchen = document.getElementById('btn-entry-kitchen');
    const btnStaff = document.getElementById('btn-entry-staff');
    const btnBrowse = document.getElementById('btn-browse-landing');

    if (btnCustomer) {
      btnCustomer.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          window.location.href = `${prefix}login.html?role=Customer`;
        }, 200);
      });
    }

    if (btnWaiter) {
      btnWaiter.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          window.location.href = `${prefix}login.html?role=Waiter`;
        }, 200);
      });
    }

    if (btnKitchen) {
      btnKitchen.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          window.location.href = `${prefix}login.html?role=Kitchen`;
        }, 200);
      });
    }

    if (btnStaff) {
      btnStaff.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          window.location.href = `${prefix}login.html?role=Manager`;
        }, 200);
      });
    }
          modal.remove();
          window.location.href = `${prefix}customer.html`;
        }, 200);
      });
    }


    const btnWaiter = document.getElementById('btn-entry-waiter');

    if (btnWaiter) {
      btnWaiter.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        authService.setUserRole('Waiter');
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          window.location.href = `${prefix}kds.html?role=waiter`;
        }, 200);
      });
    }

    if (btnStaff) {
      btnStaff.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        authService.setUserRole('Manager');
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          window.location.href = `${prefix}analytics.html`;
        }, 300);
      });
    }

    if (btnBrowse) {
      btnBrowse.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        modal.classList.add('fade-out');
        setTimeout(() => modal.remove(), 300);
      });
    }
  }
}

export const entryGatewayModal = new EntryGatewayModal();
window.entryGatewayModal = entryGatewayModal;
