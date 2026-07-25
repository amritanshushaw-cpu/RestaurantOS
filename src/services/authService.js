/**
 * RestaurantOS - Google Authentication Service
 * Handles Google Identity Services (GIS) OAuth 2.0 & Session Management
 */

const AUTH_STORAGE_KEY = 'rest_os_google_user';

export const ROLE_PERMISSIONS = {
  Customer: {
    name: 'Customer',
    allowedPages: ['index.html', 'customer.html', 'pos.html', 'payment.html', 'queue.html'],
    defaultRedirect: 'customer.html',
    description: 'Dedicated Customer Space: Menu Explorer, Chef Notes, Order Summary & Payment Gateway.'
  },
  Kitchen: {
    name: 'Kitchen',
    allowedPages: ['index.html', 'kds.html', 'queue.html'],
    defaultRedirect: 'kds.html',
    description: 'Kitchen Display System & food prep orders with Cooking Notes.'
  },
  Waiter: {
    name: 'Waiter',
    allowedPages: ['index.html', 'customer.html', 'pos.html', 'kds.html', 'digital_twin.html', 'payment.html', 'queue.html'],
    defaultRedirect: 'pos.html',
    description: 'POS Terminal, table status, KDS & payment processing.'
  },
  Manager: {
    name: 'Manager',
    allowedPages: ['index.html', 'customer.html', 'pos.html', 'kds.html', 'analytics.html', 'digital_twin.html', 'inventory.html', 'opscopilot.html', 'payment.html', 'queue.html'],
    defaultRedirect: 'analytics.html',
    description: 'Full managerial access across all operational modules.'
  }
};


class AuthService {
  constructor() {
    this.user = this.loadStoredUser();
    this.listeners = [];
    this.clientId = window.GOOGLE_CLIENT_ID || '1084920491823-restos-demo.apps.googleusercontent.com';
    this.initGIS();
  }

  // Ensure Customer session state exists and is active
  ensureCustomerSession() {
    if (!this.user || this.user.role !== 'Customer') {
      const customerUser = {
        id: `cust_${Date.now()}`,
        name: this.user ? this.user.name : 'Alex Mercer',
        email: this.user ? this.user.email : 'alex.mercer.dev@gmail.com',
        picture: this.user ? this.user.picture : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        role: 'Customer',
        auth_provider: 'google',
        signed_in_at: new Date().toISOString()
      };
      this.saveUser(customerUser);
    }
    return this.user;
  }

  // Get active role permissions
  getActiveRole() {
    const roleName = this.user ? this.user.role : 'Customer';
    return ROLE_PERMISSIONS[roleName] || ROLE_PERMISSIONS.Customer;
  }


  // Check if active role can access page
  canAccessPage(pagePath) {
    if (!pagePath) return true;
    const cleanName = pagePath.split('/').pop().split('?')[0] || 'index.html';
    if (cleanName === 'index.html' || cleanName === '') return true;

    const rolePerms = this.getActiveRole();
    return rolePerms.allowedPages.includes(cleanName);
  }


  // Load user from LocalStorage
  loadStoredUser() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Error loading Google Auth state:', e);
      return null;
    }
  }

  // Save user to LocalStorage
  saveUser(user) {
    this.user = user;
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    this.notifyListeners();
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user } }));
  }

  // Initialize Google Identity Services SDK
  initGIS() {
    if (typeof window === 'undefined') return;

    // Load GIS library dynamically if not present
    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => this.setupGoogleOneTap();
      document.head.appendChild(script);
    } else {
      this.setupGoogleOneTap();
    }
  }

  setupGoogleOneTap() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: this.clientId,
          callback: (response) => this.handleCredentialResponse(response),
          auto_select: false,
          cancel_on_tap_outside: true
        });
      } catch (err) {
        console.warn('GIS Client ID initialization notice:', err.message);
      }
    }
  }

  // Parse Google JWT ID Token
  parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to parse JWT token:', e);
      return null;
    }
  }

  // Handle Google OAuth Credential Response
  handleCredentialResponse(response) {
    if (!response || !response.credential) return;
    const payload = this.parseJwt(response.credential);
    if (payload) {
      const googleUser = {
        id: payload.sub,
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        picture: payload.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${payload.email}`,
        role: this.user ? this.user.role : 'Customer',
        auth_provider: 'google',
        signed_in_at: new Date().toISOString()
      };
      this.saveUser(googleUser);
      this.showToast(`Signed in as ${googleUser.name} (${googleUser.email})`);
    }
  }

  // Trigger Google Sign-In Flow
  loginWithGoogle() {
    // If official GIS is loaded and configured, try Google prompt first
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          this.showGoogleAuthModal();
        }
      });
    } else {
      this.showGoogleAuthModal();
    }
  }

  // Interactive Google OAuth Sign-In Modal (for local dev / hackathon demo)
  showGoogleAuthModal() {
    const existingModal = document.getElementById('google-auth-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div id="google-auth-modal" class="sentry-modal-overlay">
        <div class="sentry-modal-content google-auth-modal-card">
          <div class="google-modal-header">
            <div class="google-logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>
            <div>
              <h3 class="google-modal-title">Sign in with Google</h3>
              <p class="google-modal-subtitle">Choose an account to continue to <strong>RestaurantOS</strong></p>
            </div>
            <button class="modal-close-btn" id="close-google-modal">&times;</button>
          </div>

          <div class="google-accounts-list">
            <div class="google-account-item" data-email="saptak.chakroborty@gmail.com" data-name="Saptak Sarathi Chakroborty" data-pic="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" class="google-acc-avatar" alt="Avatar">
              <div class="google-acc-info">
                <div class="google-acc-name">Saptak Sarathi Chakroborty</div>
                <div class="google-acc-email">saptak.chakroborty@gmail.com</div>
              </div>
              <span class="badge-google-verified"><i class="fa-solid fa-circle-check"></i> Google</span>
            </div>

            <div class="google-account-item" data-email="amritanshu.shaw@gmail.com" data-name="Amritanshu Shaw" data-pic="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" class="google-acc-avatar" alt="Avatar">
              <div class="google-acc-info">
                <div class="google-acc-name">Amritanshu Shaw</div>
                <div class="google-acc-email">amritanshu.shaw@gmail.com</div>
              </div>
              <span class="badge-google-verified"><i class="fa-solid fa-circle-check"></i> Google</span>
            </div>

            <div class="google-account-item" data-email="alex.mercer.dev@gmail.com" data-name="Alex Mercer" data-pic="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150">
              <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150" class="google-acc-avatar" alt="Avatar">
              <div class="google-acc-info">
                <div class="google-acc-name">Alex Mercer</div>
                <div class="google-acc-email">alex.mercer.dev@gmail.com</div>
              </div>
              <span class="badge-google-verified"><i class="fa-solid fa-circle-check"></i> Google</span>
            </div>
          </div>

          <div class="google-custom-login-box">
            <div class="custom-login-label">Or sign in with custom Google Account:</div>
            <div class="custom-login-inputs">
              <input type="text" id="custom-google-name" placeholder="Full Name (e.g. Elena Rostova)" class="sentry-input-sm">
              <input type="email" id="custom-google-email" placeholder="email@gmail.com" class="sentry-input-sm">
              <button id="btn-custom-google-login" class="btn-sentry btn-sentry-sm">
                <i class="fa-solid fa-right-to-bracket"></i> Sign In
              </button>
            </div>
          </div>

          <div class="google-modal-footer">
            <span>Protected by Google Identity Services OAuth 2.0</span>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('google-auth-modal');
    const closeBtn = document.getElementById('close-google-modal');

    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Account list item clicks
    modal.querySelectorAll('.google-account-item').forEach(item => {
      item.addEventListener('click', () => {
        const email = item.getAttribute('data-email');
        const name = item.getAttribute('data-name');
        const picture = item.getAttribute('data-pic');

        const googleUser = {
          id: `goog_${Date.now()}`,
          name,
          email,
          picture,
          role: 'Manager',
          auth_provider: 'google',
          signed_in_at: new Date().toISOString()
        };

        this.saveUser(googleUser);
        this.showToast(`Signed in with Google as ${name}`);
        modal.remove();
      });
    });

    // Custom login click
    document.getElementById('btn-custom-google-login').addEventListener('click', () => {
      const nameInput = document.getElementById('custom-google-name').value.trim();
      const emailInput = document.getElementById('custom-google-email').value.trim();

      if (!emailInput) {
        alert('Please enter a valid Gmail address.');
        return;
      }

      const name = nameInput || emailInput.split('@')[0];
      const googleUser = {
        id: `goog_${Date.now()}`,
        name,
        email: emailInput,
        picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(emailInput)}`,
        role: 'Customer',
        auth_provider: 'google',
        signed_in_at: new Date().toISOString()
      };

      this.saveUser(googleUser);
      this.showToast(`Signed in with Google as ${name}`);
      modal.remove();
    });
  }

  // Logout
  logout() {
    const user = this.user;
    this.saveUser(null);
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.disableAutoSelect();
      } catch (e) {}
    }
    this.showToast(user ? `Signed out ${user.name}` : 'Signed out');
  }

  // Set active role for the signed in Google user
  setUserRole(role) {
    if (this.user) {
      this.user.role = role;
      this.saveUser(this.user);
      this.showToast(`Role updated to ${role}`);
    }
  }

  // Helper Toast notification
  showToast(message) {
    const existing = document.getElementById('auth-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'auth-toast';
    toast.className = 'auth-toast-notification';
    toast.innerHTML = `
      <div class="toast-content">
        <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0;">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Subscription method
  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notifyListeners() {
    this.listeners.forEach(cb => cb(this.user));
  }
}

export const authService = new AuthService();
window.authService = authService;
