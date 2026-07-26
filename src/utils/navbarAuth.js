/**
 * RestaurantOS - Navbar Google Auth Component Loader
 * Dynamically mounts Google Authentication controls into the Sentry Navigation bar.
 */

import { authService } from '../services/authService.js';
import { openEmailAuthModal } from './emailAuthModal.js';
import { entryGatewayModal } from './entryModal.js';

class NavbarAuth {
  constructor() {
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.mountWidget());
    } else {
      this.mountWidget();
    }

    window.addEventListener('auth:changed', (e) => {
      this.renderWidget(e.detail.user);
      this.applyRoleRestrictions();
    });
  }

  mountWidget() {
    const navbarInner = document.querySelector('.sentry-navbar-inner');
    if (!navbarInner) return;

    let widget = document.getElementById('sentry-google-auth-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'sentry-google-auth-widget';
      widget.className = 'sentry-auth-widget-container';
      
      const navLinks = navbarInner.querySelector('.sentry-nav-links');
      if (navLinks) {
        navbarInner.insertBefore(widget, navLinks);
      } else {
        navbarInner.appendChild(widget);
      }
    }

    this.renderWidget(authService.user);
    this.applyRoleRestrictions();
  }

  applyRoleRestrictions() {
    this.filterNavbarLinks();
    this.checkPageGuard();
  }

  // Filter navigation links based on user role
  filterNavbarLinks() {
    const links = document.querySelectorAll('.sentry-nav-links a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (authService.canAccessPage(href)) {
        link.style.display = 'inline-flex';
      } else {
        link.style.display = 'none';
      }
    });
  }

  // Enforce page-level guard for current URL
  checkPageGuard() {
    const path = window.location.pathname;
    const cleanName = path.split('/').pop().split('?')[0] || 'index.html';

    // Allow index.html and login.html
    if (cleanName === 'index.html' || cleanName === 'login.html' || cleanName === '') {
      return;
    }

    // Require authentication for all protected operational pages
    if (!authService.user) {
      const isSubdir = path.includes('/views/');
      const prefix = isSubdir ? '' : 'src/views/';
      window.location.href = `${prefix}login.html?role=Customer`;
      return;
    }

    const canAccess = authService.canAccessPage(path);
    const existingGuard = document.getElementById('rbac-page-guard-overlay');
    if (existingGuard) existingGuard.remove();

    if (!canAccess) {
      const activeRole = authService.getActiveRole();

      const guardHtml = `
        <div id="rbac-page-guard-overlay" class="rbac-guard-overlay">
          <div class="rbac-guard-card">
            <div class="rbac-guard-icon">
              <i class="fa-solid fa-lock" style="color: var(--color-warning);"></i>
            </div>
            <h2 class="rbac-guard-title">Access Restricted to ${activeRole.name} Role</h2>
            <p class="rbac-guard-desc">
              You are currently signed in as <strong>${authService.user.name}</strong> (${activeRole.name} Role).
              <br><br>
              <strong>${activeRole.name} permissions:</strong> ${activeRole.description}
            </p>
            <div class="rbac-guard-actions">
              <a href="${this.getFallbackUrl(activeRole)}" class="btn-sentry">
                <i class="fa-solid fa-arrow-right"></i> Go to ${activeRole.name} Section
              </a>
              <button id="btn-switch-role-manager" class="btn-ghost-on-dark">
                <i class="fa-solid fa-right-from-bracket"></i> Sign Out &amp; Switch Account
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', guardHtml);

      const switchBtn = document.getElementById('btn-switch-role-manager');
      if (switchBtn) {
        switchBtn.addEventListener('click', () => {
          authService.logout();
        });
      }
    }
  }

  getFallbackUrl(role) {
    const isSubdir = window.location.pathname.includes('/views/');
    const prefix = isSubdir ? '' : 'src/views/';
    if (role.name === 'Customer') return `${prefix}customer.html`;
    if (role.name === 'Kitchen') return `${prefix}kds.html`;
    return `${prefix}pos.html`;
  }


  renderWidget(user) {
    const widget = document.getElementById('sentry-google-auth-widget');
    if (!widget) return;

    if (!user) {
      widget.innerHTML = `
        <button id="btn-navbar-open-space" class="btn-google-sign-in">
          <svg class="google-svg-icon" width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Sign In / Choose Mode</span>
        </button>
      `;

      const openBtn = widget.querySelector('#btn-navbar-open-space');
      if (openBtn) {
        openBtn.addEventListener('click', () => entryGatewayModal.renderModal(true));
      }
    } else {
      const avatarSrc = user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`;
      const roleColor = user.role === 'Manager' ? 'var(--color-accent-violet)' :
                        user.role === 'Kitchen' ? 'var(--color-warning)' :
                        user.role === 'Waiter' ? 'var(--color-accent-pink)' : 'var(--color-accent-lime)';

      widget.innerHTML = `
        <div class="google-user-profile-badge">
          <div class="user-avatar-wrapper">
            <img src="${avatarSrc}" class="google-user-avatar" alt="${user.name}">
            <div class="google-mini-icon-badge" title="Authenticated via Google">
              <svg width="10" height="10" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>
          </div>

          <div class="google-user-details">
            <span class="google-user-name">${user.name}</span>
            <div class="google-user-meta">
              <span class="user-role-chip" style="color: ${roleColor}; border-color: ${roleColor}40;">${user.role}</span>
            </div>
          </div>

          <div class="google-user-actions">
            <button id="btn-navbar-logout" class="btn-icon-logout" title="Sign Out">
              <i class="fa-solid fa-right-from-bracket"></i> Sign Out
            </button>
          </div>
        </div>
      `;

      const logoutBtn = widget.querySelector('#btn-navbar-logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => authService.logout());
      }
    }
  }
}

export const navbarAuth = new NavbarAuth();

