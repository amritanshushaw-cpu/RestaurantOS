/**
 * RestaurantOS - Workspace Selection Space & Role Signing Window Gateway
 * Flow:
 * 1. Sign In click or Gateway parameter -> Opens Workspace Selection Space (Customer, Waiter, Kitchen, Manager cards).
 * 2. Mode Card Chosen:
 *    - If already signed in: sets role & opens specific workspace UI directly.
 *    - If signed out: opens Signing Window Modal (Google OAuth / Email OTP / Quick Enter), authenticates & opens specific workspace UI directly.
 */

import { authService } from '../services/authService.js';
import { openEmailAuthModal } from './emailAuthModal.js';

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
    const path = window.location.pathname;
    const isLanding = path.endsWith('index.html') || path.endsWith('/') || path === '';
    const urlParams = new URLSearchParams(window.location.search);
    const forceGateway = urlParams.get('gateway') === '1';

    if (isLanding) {
      if (forceGateway) {
        this.renderModal();
      }
    }
  }

  renderModal(forceShow = false) {
    const existing = document.getElementById('entry-gateway-modal');
    if (existing) existing.remove();

    const isSubdir = window.location.pathname.includes('/views/');
    const prefix = isSubdir ? '' : 'src/views/';
    const currentUser = authService.user;

    const modalHtml = `
      <div id="entry-gateway-modal" class="entry-gateway-backdrop" style="display:flex;">
        <div class="entry-modal-card" style="max-width: 1040px; width: 94%;">
          <div class="entry-modal-header">
            <div class="entry-brand-logo">
              <i class="fa-solid fa-utensils"></i>
            </div>
            <h2 class="entry-modal-title">Select Workspace Mode</h2>
            <p class="entry-modal-subtitle">
              ${currentUser 
                ? `Signed in as <strong style="color:var(--color-accent-lime);">${currentUser.name}</strong> (${currentUser.role} Mode) · Pick a mode to enter its workspace`
                : 'Choose your workspace mode to enter with real Supabase Auth (Email OTP / Google OAuth)'}
            </p>
          </div>

          <div class="entry-options-grid">
            <!-- Mode 1: Customer -->
            <button type="button" id="btn-mode-customer" class="entry-option-card card-cust-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-lime"><i class="fa-solid fa-user"></i> Customer</span>
                <span class="entry-tag">Dining UI</span>
              </div>
              <div class="entry-option-icon icon-lime">
                <i class="fa-solid fa-utensils"></i>
              </div>
              <h3 class="entry-option-title">Customer Mode</h3>
              <p class="entry-option-desc">Dynamic menu card, 6-digit session ID generation, table booking &amp; live order bill.</p>
              <div class="entry-action-link btn-lime-action">
                <span>Enter Customer</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>

            <!-- Mode 2: Waiter -->
            <button type="button" id="btn-mode-waiter" class="entry-option-card card-waiter-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-pink"><i class="fa-solid fa-bell-concierge"></i> Waiter</span>
                <span class="entry-tag">Waiter UI</span>
              </div>
              <div class="entry-option-icon" style="background: rgba(236,72,153,0.15); color: #ec4899; border-color: rgba(236,72,153,0.3);">
                <i class="fa-solid fa-bell-concierge"></i>
              </div>
              <h3 class="entry-option-title">Waiter Mode</h3>
              <p class="entry-option-desc">Live table booking alerts, order notifications &amp; payment type (Cash/Card/UPI) alerts.</p>
              <div class="entry-action-link" style="background: #ec4899; color: #000;">
                <span>Enter Waiter</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>

            <!-- Mode 3: Kitchen -->
            <button type="button" id="btn-mode-kitchen" class="entry-option-card card-kitchen-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-blue"><i class="fa-solid fa-fire"></i> Kitchen</span>
                <span class="entry-tag">KDS Prep</span>
              </div>
              <div class="entry-option-icon" style="background: rgba(59,130,246,0.15); color: #3b82f6; border-color: rgba(59,130,246,0.3);">
                <i class="fa-solid fa-fire"></i>
              </div>
              <h3 class="entry-option-title">Kitchen Mode</h3>
              <p class="entry-option-desc">Kitchen Display System (KDS), cooking notes, order status &amp; Mark as Served (Delivered: Y).</p>
              <div class="entry-action-link" style="background: #3b82f6; color: #fff;">
                <span>Enter Kitchen</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>

            <!-- Mode 4: Manager -->
            <button type="button" id="btn-mode-manager" class="entry-option-card card-manager-option">
              <div class="entry-card-top">
                <span class="entry-badge badge-violet"><i class="fa-solid fa-user-shield"></i> Manager</span>
                <span class="entry-tag">Admin UI</span>
              </div>
              <div class="entry-option-icon icon-violet">
                <i class="fa-solid fa-chart-line"></i>
              </div>
              <h3 class="entry-option-title">Manager Mode</h3>
              <p class="entry-option-desc">Post-admin auth data tables (Main Data, Table Vacancy, Customer History) &amp; BI revenue dashboard.</p>
              <div class="entry-action-link btn-violet-action">
                <span>Enter Manager</span> <i class="fa-solid fa-arrow-right"></i>
              </div>
            </button>
          </div>

          <div class="entry-modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
            <button type="button" id="btn-browse-landing" class="btn-ghost-sm">
              <i class="fa-solid fa-eye"></i> Browse Overview Landing Page First
            </button>
            <span style="font-size:12px; color:var(--text-tertiary);">RestaurantOS v2.4 · Multi-Tenant Role Switcher</span>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('entry-gateway-modal');
    const btnCustomer = document.getElementById('btn-mode-customer');
    const btnWaiter = document.getElementById('btn-mode-waiter');
    const btnKitchen = document.getElementById('btn-mode-kitchen');
    const btnManager = document.getElementById('btn-mode-manager');
    const btnBrowse = document.getElementById('btn-browse-landing');

    const handleSelectRole = (role, targetPage) => {
      sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
      modal.remove();

      if (authService.user) {
        authService.setUserRole(role);
        authService.showToast(`Entering ${role} Workspace Mode…`);
        setTimeout(() => {
          window.location.href = targetPage;
        }, 200);
      } else {
        this.openSigningWindow(role, targetPage);
      }
    };

    btnCustomer?.addEventListener('click', () => handleSelectRole('Customer', `${prefix}customer.html`));
    btnWaiter?.addEventListener('click', () => handleSelectRole('Waiter', `${prefix}pos.html`));
    btnKitchen?.addEventListener('click', () => handleSelectRole('Kitchen', `${prefix}kds.html`));
    btnManager?.addEventListener('click', () => handleSelectRole('Manager', `${prefix}analytics.html`));

    btnBrowse?.addEventListener('click', () => {
      sessionStorage.setItem('rest_os_gateway_dismissed', 'true');
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 250);
    });
  }

  openSigningWindow(roleName, targetUrl) {
    const existing = document.getElementById('signing-window-modal');
    if (existing) existing.remove();

    const roleColor = roleName === 'Customer' ? 'var(--color-accent-lime)' :
                      roleName === 'Waiter' ? '#ec4899' :
                      roleName === 'Kitchen' ? '#3b82f6' : 'var(--color-accent-violet)';

    const modalHtml = `
      <div id="signing-window-modal" class="sentry-modal-overlay" style="z-index: 9999;">
        <div class="sentry-modal-content google-auth-modal-card" style="max-width: 440px; border-color: ${roleColor}; box-shadow: 0 20px 50px rgba(0,0,0,0.7);">
          <div class="google-modal-header">
            <div>
              <span class="entry-badge" style="background:${roleColor}20; color:${roleColor}; border:1px solid ${roleColor}40; margin-bottom:6px;">
                <i class="fa-solid fa-lock"></i> ${roleName.toUpperCase()} SIGN IN
              </span>
              <h3 class="google-modal-title" style="margin-top:4px;">Sign in for ${roleName} Mode</h3>
              <p class="google-modal-subtitle">Authenticate to enter ${roleName} specific UI</p>
            </div>
            <button class="modal-close-btn" id="close-signing-window">&times;</button>
          </div>

          <div class="google-custom-login-box" style="display:flex; flex-direction:column; gap:12px; margin: 16px 0;">
            <button type="button" id="btn-signing-google" class="btn-google-sign-in" style="width:100%; justify-content:center; padding:12px 18px; font-size:13px;">
              <svg class="google-svg-icon" width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>

            <button type="button" id="btn-signing-email" class="btn-sentry btn-sentry-sm" style="width:100%; justify-content:center; padding:12px 18px; font-size:13px; background:var(--color-primary); color:var(--text-primary); border:1px solid var(--border-violet);">
              <i class="fa-solid fa-envelope" style="color:var(--color-accent-lime);"></i> Sign in with Email OTP
            </button>

            <button type="button" id="btn-signing-quick" class="btn-ghost-sm" style="margin-top:4px; padding:10px; border:1px dashed var(--border-violet); border-radius:12px; color:${roleColor}; font-weight:700;">
              <i class="fa-solid fa-bolt"></i> Quick Enter as ${roleName} Guest →
            </button>
          </div>

          <div class="google-modal-footer" style="text-align:center;">
            <span>After sign in, you will be redirected directly to ${roleName} UI</span>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('signing-window-modal');

    document.getElementById('close-signing-window')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('btn-signing-google')?.addEventListener('click', () => {
      modal.remove();
      authService.loginWithGoogle(roleName, targetUrl);
    });

    document.getElementById('btn-signing-email')?.addEventListener('click', () => {
      modal.remove();
      openEmailAuthModal(roleName, targetUrl);
    });

    document.getElementById('btn-signing-quick')?.addEventListener('click', () => {
      const demoNames = {
        Customer: 'Alex Mercer',
        Waiter: 'Sam (Waitstaff)',
        Kitchen: 'Chef Marco',
        Manager: 'Director Vance'
      };

      const user = {
        id: 'user-' + Date.now(),
        name: demoNames[roleName] || `${roleName} Guest`,
        email: `${(roleName).toLowerCase()}@restaurantos.com`,
        role: roleName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(roleName)}`
      };

      authService.saveUser(user);
      authService.showToast(`Signed in as ${user.name} (${roleName} Mode). Redirecting...`);
      modal.remove();
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 300);
    });
  }
}

export const entryGatewayModal = new EntryGatewayModal();
window.entryGatewayModal = entryGatewayModal;
