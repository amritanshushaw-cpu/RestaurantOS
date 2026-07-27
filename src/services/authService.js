/**
 * RestaurantOS - Authentication Service
 * Real Google OAuth (via Supabase Auth) + real email OTP verification.
 * No fake/demo account picker -- every sign-in goes through Supabase's
 * actual GoTrue backend when configured (see src/config.js).
 *
 * Public API is unchanged from the previous version so navbarAuth.js and
 * entryModal.js work without modification:
 *   authService.user, .ensureCustomerSession(), .getActiveRole(),
 *   .canAccessPage(), .loginWithGoogle(), .logout(), .setUserRole(),
 *   .onAuthStateChanged()
 *
 * New methods added for email OTP verification:
 *   .sendEmailOtp(email), .verifyEmailOtp(email, token)
 */

import { dbEngine } from './supabaseClient.js';

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
    this.clientId = window.GOOGLE_CLIENT_ID || '';
    this.pendingOtpEmail = null;
    this.initSupabaseSessionSync();

    // Prevent accidental closing of window without warning
    window.addEventListener('beforeunload', (e) => {
      if (this.user && !window.isAppNavigation) {
        // Modern browsers will show a generic "Changes you made may not be saved" dialog.
        // Some older browsers might display this custom string.
        e.preventDefault();
        e.returnValue = 'Are you sure you want to log out and leave this page?';
        return e.returnValue;
      }
    });
  }

  // ---------------------------------------------------------------------
  // Real backend session sync
  // ---------------------------------------------------------------------

  // If Supabase is configured, keep authService.user in lockstep with the
  // real GoTrue session -- this is what makes Google OAuth, email OTP, and
  // page refreshes all behave consistently instead of relying on a
  // separate locally-faked login state.
  initSupabaseSessionSync() {
    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      if (!dbEngine.supabase) {
        console.info('RestaurantOS: Supabase not configured (src/config.js is empty). Running in local demo mode -- Google/OTP sign-in will show a setup notice instead of failing silently.');
      }
      return;
    }

    // Restore any existing real session (e.g. after an OAuth redirect back)
    dbEngine.supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) this.handleSupabaseSession(data.session);
    });

    dbEngine.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.handleSupabaseSession(session);
      } else if (event === 'SIGNED_OUT') {
        this.saveUser(null);
      }
    });
  }

  getRoleRedirectUrl(role = 'Customer') {
    const isSubdir = window.location.pathname.includes('/views/');
    const prefix = isSubdir ? '' : 'src/views/';
    switch (role) {
      case 'Waiter': return `${prefix}pos.html`;
      case 'Kitchen': return `${prefix}kds.html`;
      case 'Manager': return `${prefix}analytics.html`;
      case 'Customer': default: return `${prefix}customer.html`;
    }
  }

  // Turn a real Supabase session into the same user shape the rest of the
  // app already expects (id/name/email/picture/role/auth_provider).
  async handleSupabaseSession(session, overrideRole = null) {
    const authUser = session.user;
    const meta = authUser.user_metadata || {};
    const provider = authUser.app_metadata?.provider || 'email';

    const pendingRole = localStorage.getItem('rest_os_pending_google_role');
    const pendingRedirect = localStorage.getItem('rest_os_pending_redirect');

    let role = overrideRole || pendingRole || this.user?.role || 'Customer';
    if (pendingRole) localStorage.removeItem('rest_os_pending_google_role');

    try {
      const { data, error } = await dbEngine.supabase
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', authUser.id)
        .single();
      if (!error && data) {
        role = data.role || role;
      }
    } catch (e) {
      console.warn('Profile lookup notice:', e.message);
    }

    const sessionUser = {
      id: authUser.id,
      name: meta.full_name || meta.name || authUser.email.split('@')[0],
      email: authUser.email,
      picture: meta.avatar_url || meta.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authUser.email)}`,
      role,
      auth_provider: provider,
      email_verified: !!authUser.email_confirmed_at,
      signed_in_at: new Date().toISOString()
    };

    await dbEngine.syncUserProfile(sessionUser);
    this.saveUser(sessionUser);
    this.showToast(`Signed in as ${sessionUser.name} (${sessionUser.role} Mode)`);
    this.closeAuthModal();

    if (pendingRedirect) {
      localStorage.removeItem('rest_os_pending_redirect');
      setTimeout(() => {
        window.isAppNavigation = true;
        window.location.href = pendingRedirect;
      }, 300);
    } else if (window.location.pathname.includes('login.html')) {
      // Auto-redirect if we are on the login page (e.g. after OAuth or Magic Link return)
      const isSubdir = window.location.pathname.includes('/views/');
      const prefix = isSubdir ? '' : 'src/views/';
      window.isAppNavigation = true;
      if (role === 'Manager') window.location.href = `${prefix}analytics.html`;
      else if (role === 'Waiter') window.location.href = `${prefix}kds.html?role=waiter`;
      else if (role === 'Kitchen') window.location.href = `${prefix}kds.html?role=kitchen`;
      else window.location.href = `${prefix}customer.html`;
    }
  }

  // ---------------------------------------------------------------------
  // Session state (unchanged from previous version)
  // ---------------------------------------------------------------------

  ensureCustomerSession() {
    if (!this.user || this.user.role !== 'Customer') {
      const customerUser = {
        id: `cust_${Date.now()}`,
        name: this.user ? this.user.name : 'Guest',
        email: this.user ? this.user.email : null,
        picture: this.user ? this.user.picture : `https://api.dicebear.com/7.x/avataaars/svg?seed=guest${Date.now()}`,
        role: 'Customer',
        auth_provider: 'guest',
        signed_in_at: new Date().toISOString()
      };
      this.saveUser(customerUser);
    }
    return this.user;
  }

  getActiveRole() {
    const roleName = this.user ? this.user.role : 'Customer';
    return ROLE_PERMISSIONS[roleName] || ROLE_PERMISSIONS.Customer;
  }

  canAccessPage(pagePath) {
    if (!pagePath) return true;
    const cleanName = pagePath.split('/').pop().split('?')[0] || 'index.html';
    if (cleanName === 'index.html' || cleanName === '') return true;

    const rolePerms = this.getActiveRole();
    return rolePerms.allowedPages.includes(cleanName);
  }

  loadStoredUser() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Error loading auth state:', e);
      return null;
    }
  }

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

  // ---------------------------------------------------------------------
  // Real Email & Password Authentication (Supabase GoTrue Backend)
  // ---------------------------------------------------------------------

  async loginWithOtp(email, role = 'Customer') {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail) {
      this.showToast('Please enter your email address.');
      return { ok: false, reason: 'missing_fields' };
    }

    try {
      const { error } = await dbEngine.supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          data: {
            role: role
          }
        }
      });

      if (error) {
        this.showToast(`OTP failed: ${error.message}`);
        return { ok: false, reason: error.message };
      }

      this.showToast('Magic link sent! Please check your email to log in.');
      return { ok: true };
    } catch (e) {
      this.showToast(`Authentication error: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  }

  async signUpWithEmailPassword(email, password, fullName = '', role = 'Customer') {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail || !password) {
      this.showToast('Please enter email and password to sign up.');
      return { ok: false, reason: 'missing_fields' };
    }

    try {
      const { data, error } = await dbEngine.supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName || cleanEmail.split('@')[0],
            role: role || 'Customer'
          }
        }
      });

      if (error) {
        this.showToast(`Sign up failed: ${error.message}`);
        return { ok: false, reason: error.message };
      }

      if (data.session) {
        await this.handleSupabaseSession(data.session, role);
      } else {
        this.showToast(`Account created for ${cleanEmail}! Please check email or sign in.`);
      }

      return { ok: true, data };
    } catch (e) {
      this.showToast(`Sign up error: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  }

  // ---------------------------------------------------------------------
  // Google Authentication (Freeze-Proof Direct Account Authentication)
  // ---------------------------------------------------------------------

  async loginWithGoogle(role = 'Customer', targetUrl = null) {
    const finalTarget = targetUrl || this.getRoleRedirectUrl(role);

    // Save the intended role and target redirect in localStorage so we can
    // assign them after OAuth redirect back
    localStorage.setItem('rest_os_pending_google_role', role);
    localStorage.setItem('rest_os_pending_redirect', finalTarget);

    // If Supabase is not configured, fall back to demo sign-in and redirect
    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      const demoNames = {
        Customer: 'Alex Mercer', Waiter: 'Sam (Waitstaff)',
        Kitchen: 'Chef Marco', Manager: 'Director Vance'
      };
      const user = {
        id: 'demo-' + Date.now(),
        name: demoNames[role] || `${role} Guest`,
        email: `${role.toLowerCase()}@restaurantos.com`,
        role: role,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(role)}`
      };
      this.saveUser(user);
      this.showToast(`Demo Mode: Signed in as ${user.name}`);
      setTimeout(() => { 
        window.isAppNavigation = true;
        window.location.href = finalTarget; 
      }, 350);
      return;
    }

    try {
      const { error } = await dbEngine.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // ALWAYS redirect to canonical root to prevent Vercel 308 cleanUrl redirects from dropping the #access_token hash
          redirectTo: window.location.origin + '/'
        }
      });
      if (error) {
        this.showToast(`Google Sign-In failed: ${error.message}`);
      }
    } catch (e) {
      this.showToast(`Authentication error: ${e.message}`);
    }
  }

  // ---------------------------------------------------------------------
  // Real Email OTP Verification (Supabase Auth)
  // ---------------------------------------------------------------------

  async sendEmailOtp(email) {
    const cleanEmail = (email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      this.showToast('Enter a valid email address first.');
      return { ok: false, reason: 'invalid_email' };
    }

    // Demo fallback when Supabase isn't configured
    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      this.pendingOtpEmail = cleanEmail;
      this.showToast(`Demo mode — use code 123456 for ${cleanEmail}`);
      return { ok: true };
    }

    try {
      const { error } = await dbEngine.supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true }
      });
      if (error) {
        this.showToast(`Verification error: ${error.message}`);
        return { ok: false, reason: error.message };
      }
      this.pendingOtpEmail = cleanEmail;
      this.showToast(`Verification code sent to ${cleanEmail}`);
      return { ok: true };
    } catch (e) {
      this.showToast(`Could not send verification code: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  }

  async verifyEmailOtp(email, token, role = 'Customer', targetUrl = null) {
    const cleanEmail = (email || this.pendingOtpEmail || '').trim();
    const cleanToken = (token || '').trim();
    const finalTarget = targetUrl || this.getRoleRedirectUrl(role);

    localStorage.setItem('rest_os_pending_google_role', role);
    localStorage.setItem('rest_os_pending_redirect', finalTarget);

    if (!cleanToken) {
      this.showToast('Please enter the 6-digit verification code.');
      return { ok: false, reason: 'missing_token' };
    }

    // Demo fallback when Supabase isn't configured
    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      if (cleanToken !== '123456') {
        this.showToast('Invalid demo code. Use 123456.');
        return { ok: false, reason: 'invalid_code' };
      }
      const user = {
        id: 'email-demo-' + Date.now(),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        role: role,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`
      };
      this.saveUser(user);
      this.showToast(`Demo verified as ${user.name} (${role} Mode). Redirecting…`);
      this.pendingOtpEmail = null;
      setTimeout(() => { 
        window.isAppNavigation = true;
        window.location.href = finalTarget; 
      }, 350);
      return { ok: true };
    }

    try {
      const { data, error } = await dbEngine.supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email'
      });
      if (error || !data?.session) {
        this.showToast(`Verification failed: ${error ? error.message : 'invalid code'}`);
        return { ok: false, reason: error ? error.message : 'invalid_code' };
      }
      this.pendingOtpEmail = null;
      await this.handleSupabaseSession(data.session, role);
      this.closeAuthModal();
      return { ok: true };
    } catch (e) {
      this.showToast(`Verification failed: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  }
  showAuthSetupNotice(featureName) {
    this.showToast(`${featureName} needs Supabase credentials in src/config.js first.`);
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.remove();
  }

  // ---------------------------------------------------------------------
  // Logout / role switching (unchanged)
  // ---------------------------------------------------------------------

  logout() {
    const user = this.user;
    if (user) {
      dbEngine.clearActiveSession(user.email || user.id);
    }
    this.saveUser(null);
    if (dbEngine.supabase) {
      try {
        dbEngine.supabase.auth.signOut();
      } catch (e) {}
    }
    this.showToast(user ? `Signed out ${user.name}. Active Session ID cleared!` : 'Signed out. Active Session ID cleared!');
  }

  setUserRole(role) {
    if (this.user) {
      this.user.role = role;
      this.saveUser(this.user);
      dbEngine.syncUserProfile(this.user);
      this.showToast(`Role updated to ${role}`);
    }
  }

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
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

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
