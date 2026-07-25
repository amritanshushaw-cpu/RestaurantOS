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

          <div class="entry-options-grid">
            <!-- Option 1: Customer Space -->
            <button type="button" id="btn-entry-customer" class="entry-option-card card-cust-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-lime"><i class="fa-solid fa-user"></i> Customer Mode</span>
                <span class="entry-tag">Customer UI</span>
              </div>
              <div class="entry-option-icon icon-lime">
                <i class="fa-solid fa-utensils"></i>
              </div>
              <h3 class="entry-option-title">Sign in as a Customer</h3>
              <p class="entry-option-desc">Browse gourmet menu items, add custom cooking instructions, view live order summary & itemized bill, and checkout securely.</p>
              <div class="entry-action-link btn-lime-action">
                <span>Continue as Customer</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>

            <!-- Option 2: Staff Space -->
            <button type="button" id="btn-entry-staff" class="entry-option-card card-staff-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-violet"><i class="fa-solid fa-user-shield"></i> Staff Portal</span>
                <span class="entry-tag">Operations UI</span>
              </div>
              <div class="entry-option-icon icon-violet">
                <i class="fa-solid fa-cash-register"></i>
              </div>
              <h3 class="entry-option-title">Sign in as a Staff</h3>
              <p class="entry-option-desc">Access Waitstaff POS Terminal, Kitchen KDS tickets, 3D Digital Twin floor map, AI stockout predictor & sales analytics.</p>
              <div class="entry-action-link btn-violet-action">
                <span>Continue as Staff</span> <i class="fa-solid fa-arrow-right"></i>
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
    const btnStaff = document.getElementById('btn-entry-staff');
    const btnBrowse = document.getElementById('btn-browse-landing');

    if (btnCustomer) {
      btnCustomer.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        authService.ensureCustomerSession();
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          window.location.href = `${prefix}customer.html`;
        }, 200);
      });
    }


    if (btnStaff) {
      btnStaff.addEventListener('click', () => {
        sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
        if (!authService.user || authService.user.role === 'Customer') {
          authService.setUserRole('Manager');
        }
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          window.location.href = `${prefix}pos.html`;
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
