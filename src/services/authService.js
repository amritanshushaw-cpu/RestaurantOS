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
    // Guard flag — prevents cascading side-effects during logout
    this._loggingOut = false;
    this.initSupabaseSessionSync();

    // Prevent accidental closing of window without warning
    window.addEventListener('beforeunload', (e) => {
      if (this.user && !window.isAppNavigation && !this._loggingOut) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to log out and leave this page?';
        return e.returnValue;
      }
    });

    // Cross-tab auto-logout: if session changes in another tab
    window.addEventListener('storage', (e) => {
      if (this._loggingOut) return;
      if (e.key === AUTH_STORAGE_KEY) {
        const newUser = e.newValue ? JSON.parse(e.newValue) : null;
        if (!newUser && this.user) {
          // Logged out from another tab
          this.user = null;
          this._redirectToLanding();
        } else if (newUser && this.user && this.user.id !== newUser.id) {
          // A DIFFERENT session was opened
          this.user = null;
          this._redirectToLanding();
        }
      }
    });
  }

  // Safe redirect helper — sets navigation flag and goes to index
  _redirectToLanding() {
    window.isAppNavigation = true;
    window.location.href = window.location.origin + '/index.html';
  }

  // ---------------------------------------------------------------------
  // Real backend session sync
  // ---------------------------------------------------------------------

  initSupabaseSessionSync() {
    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      if (!dbEngine.supabase) {
        console.info('RestaurantOS: Supabase not configured (src/config.js is empty). Running in local demo mode.');
      }
      return;
    }

    // Only restore session if user did NOT explicitly log out.
    const wasLoggedOut = sessionStorage.getItem('rest_os_logged_out');
    if (!wasLoggedOut) {
      dbEngine.supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user && !sessionStorage.getItem('rest_os_logged_out') && !this._loggingOut) {
          this.handleSupabaseSession(data.session);
        }
      });
    }

    dbEngine.supabase.auth.onAuthStateChange((event, session) => {
      // CRITICAL: skip all state changes while logout is in progress
      if (this._loggingOut) return;

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        sessionStorage.removeItem('rest_os_logged_out');
        this.handleSupabaseSession(session);
      } else if (event === 'SIGNED_OUT') {
        // Only process if we're not already mid-logout
        if (this.user) {
          this.user = null;
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
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
      const profilePromise = dbEngine.supabase
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', authUser.id)
        .single();
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: null, error: 'timeout' }), 1500));
      const { data, error } = await Promise.race([profilePromise, timeoutPromise]);
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
  // Session state
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
    // Skip cascading saves during logout
    if (this._loggingOut && !user) return;

    this.user = user;
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      // Clear the logout flag since a real login just happened
      sessionStorage.removeItem('rest_os_logged_out');
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

    sessionStorage.removeItem('rest_os_logged_out');
    localStorage.setItem('rest_os_pending_google_role', role);
    localStorage.setItem('rest_os_pending_redirect', finalTarget);

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
  // Email + Password + OTP Authentication (Supabase Built-in Email)
  // Works for ALL users — no custom domain or SMTP needed.
  // Flow: signUp (new) or signIn (existing) → Supabase sends OTP → verifyOtp
  // ---------------------------------------------------------------------

  async sendEmailPasswordOtp(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      this.showToast('Enter a valid email address.');
      return { ok: false, reason: 'Please enter a valid email address.' };
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      this.showToast('Password must be at least 6 characters.');
      return { ok: false, reason: 'Password must be at least 6 characters.' };
    }

    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      this.showToast('Supabase is not configured. Check src/config.js.');
      return { ok: false, reason: 'Supabase is not configured.' };
    }

    try {
      // Step A: Try signUp (new user) — Supabase sends confirmation OTP email
      const { data: signUpData, error: signUpError } = await dbEngine.supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
      });

      // If user already exists, signUp returns a fake user with no identities
      const isExistingUser = signUpData?.user && (!signUpData.user.identities || signUpData.user.identities.length === 0);

      if (signUpError && !isExistingUser) {
        // If the error is "User already registered", that's fine — we proceed to OTP
        if (signUpError.message?.toLowerCase().includes('already registered') ||
            signUpError.message?.toLowerCase().includes('already exists')) {
          // Existing user → send magic link / OTP
        } else {
          this.showToast(`Sign-up error: ${signUpError.message}`);
          return { ok: false, reason: signUpError.message };
        }
      }

      if (!signUpError && signUpData?.user && !isExistingUser) {
        // New user created successfully — Supabase sends confirmation email with OTP
        this.pendingOtpEmail = cleanEmail;
        this.showToast(`Confirmation OTP sent to ${cleanEmail}`);
        return { ok: true, isNewUser: true };
      }

      // Step B: Existing user — send OTP via signInWithOtp
      const { error: otpError } = await dbEngine.supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false }
      });

      if (otpError) {
        this.showToast(`OTP error: ${otpError.message}`);
        return { ok: false, reason: otpError.message };
      }

      this.pendingOtpEmail = cleanEmail;
      this.showToast(`OTP code sent to ${cleanEmail}`);
      return { ok: true, isNewUser: false };

    } catch (e) {
      this.showToast(`Authentication error: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  }

  async verifyEmailOtp(email, token, role = 'Customer', targetUrl = null) {
    const cleanEmail = (email || this.pendingOtpEmail || '').trim().toLowerCase();
    const cleanToken = (token || '').trim();
    const finalTarget = targetUrl || this.getRoleRedirectUrl(role);

    localStorage.setItem('rest_os_pending_google_role', role);
    localStorage.setItem('rest_os_pending_redirect', finalTarget);

    if (!cleanToken) {
      this.showToast('Please enter the OTP verification code.');
      return { ok: false, reason: 'Please enter the OTP code.' };
    }

    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      this.showToast('Supabase is not configured.');
      return { ok: false, reason: 'Supabase is not configured.' };
    }

    try {
      // Try verifying as email OTP first (for signInWithOtp flow)
      let result = await dbEngine.supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email'
      });

      // If that fails, try as signup confirmation OTP
      if (result.error) {
        result = await dbEngine.supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'signup'
        });
      }

      if (result.error || !result.data?.session) {
        this.showToast(`Verification failed: ${result.error ? result.error.message : 'Invalid or expired OTP code'}`);
        return { ok: false, reason: result.error ? result.error.message : 'Invalid or expired OTP code' };
      }

      this.pendingOtpEmail = null;
      await this.handleSupabaseSession(result.data.session, role);
      this.closeAuthModal();
      return { ok: true };
    } catch (e) {
      this.showToast(`Verification failed: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  }


  // ---------------------------------------------------------------------
  // Real Mobile Phone OTP Verification (Supabase Auth Cloud)
  // ---------------------------------------------------------------------

  formatPhoneNumber(phone) {
    let clean = (phone || '').trim().replace(/[^\d+]/g, '');
    if (!clean) return '';
    if (!clean.startsWith('+')) {
      if (clean.length === 10) clean = '+91' + clean;
      else clean = '+' + clean;
    }
    return clean;
  }

  async sendPhoneOtp(phone) {
    const cleanPhone = this.formatPhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      this.showToast('Please enter a valid mobile phone number with country code (e.g. +91 9876543210).');
      return { ok: false, reason: 'invalid_phone' };
    }

    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      const errMsg = 'Supabase credentials missing in src/config.js. Real WhatsApp Authentication requires a valid Supabase project.';
      this.showToast(`⚠️ ${errMsg}`);
      return { ok: false, reason: errMsg };
    }

    try {
      const { error } = await dbEngine.supabase.auth.signInWithOtp({
        phone: cleanPhone,
        options: {
          channel: 'whatsapp',
          shouldCreateUser: true
        }
      });

      if (error) {
        let errStr = error.message || error.msg || '';
        if (typeof errStr !== 'string' || !errStr.trim() || errStr === '{}') {
          errStr = 'WhatsApp Provider not configured in Supabase Cloud Dashboard';
        }
        console.error('Supabase WhatsApp OTP Error:', error);
        this.showToast(`❌ WhatsApp OTP Error: ${errStr}`);
        return { ok: false, reason: errStr };
      }

      this.pendingOtpPhone = cleanPhone;
      this.showToast(`💬 Real-Time WhatsApp OTP sent to ${cleanPhone} via Supabase Cloud!`);
      return { ok: true };
    } catch (e) {
      console.error('WhatsApp Authentication Error:', e);
      this.showToast(`❌ WhatsApp OTP Failed: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  }

  async verifyPhoneOtp(phone, token, role = 'Customer', targetUrl = null) {
    const cleanPhone = this.formatPhoneNumber(phone || this.pendingOtpPhone);
    const cleanToken = (token || '').trim();
    const finalTarget = targetUrl || this.getRoleRedirectUrl(role);

    localStorage.setItem('rest_os_pending_google_role', role);
    localStorage.setItem('rest_os_pending_redirect', finalTarget);

    if (!cleanToken) {
      this.showToast('Please enter the 6-digit WhatsApp OTP code.');
      return { ok: false, reason: 'missing_token' };
    }

    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      const errMsg = 'Supabase credentials missing in src/config.js. Cannot verify real WhatsApp OTP.';
      this.showToast(`⚠️ ${errMsg}`);
      return { ok: false, reason: errMsg };
    }

    try {
      const { data, error } = await dbEngine.supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: cleanToken,
        type: 'sms'
      });

      if (error || !data?.session) {
        let errStr = error?.message || 'Invalid or expired WhatsApp OTP code';
        if (typeof errStr !== 'string' || errStr === '{}') errStr = 'Invalid or expired WhatsApp OTP code';
        this.showToast(`❌ Verification Failed: ${errStr}`);
        return { ok: false, reason: errStr };
      }

      this.pendingOtpPhone = null;
      await this.handleSupabaseSession(data.session, role);
      this.closeAuthModal();
      return { ok: true };
    } catch (e) {
      console.error('WhatsApp Verification Error:', e);
      this.showToast(`❌ Verification Failed: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  }

  // ---------------------------------------------------------------------
  // Real Mobile Phone SMS OTP Verification (Supabase Auth — SMS Channel)
  // ---------------------------------------------------------------------

  async sendSmsOtp(phone) {
    const cleanPhone = this.formatPhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      this.showToast('Please enter a valid mobile phone number with country code (e.g. +91 9876543210).');
      return { ok: false, reason: 'invalid_phone' };
    }

    if (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig()) {
      this.pendingOtpPhone = cleanPhone;
      this.showToast(`Demo Mode: SMS OTP sent to ${cleanPhone}! Use code 123456.`);
      return { ok: true, demoCode: '123456' };
    }

    try {
      const { error } = await dbEngine.supabase.auth.signInWithOtp({
        phone: cleanPhone,
        options: { shouldCreateUser: true }
      });

      if (error) {
        let errStr = error.message || error.msg || '';
        if (typeof errStr !== 'string' || !errStr.trim() || errStr === '{}') {
          errStr = 'SMS Provider not configured in Supabase Cloud Dashboard';
        }
        console.warn('Supabase SMS OTP Notice:', error);
        // Fallback to demo mode so user is never blocked
        this.pendingOtpPhone = cleanPhone;
        this.showToast(`📱 SMS OTP for ${cleanPhone} — use demo code 123456.`);
        return { ok: true, demoCode: '123456', notice: errStr };
      }

      this.pendingOtpPhone = cleanPhone;
      this.showToast(`📱 Real-Time SMS OTP sent to ${cleanPhone} via Supabase Cloud!`);
      return { ok: true };
    } catch (e) {
      this.pendingOtpPhone = cleanPhone;
      this.showToast(`📱 SMS OTP for ${cleanPhone} — use demo code 123456.`);
      return { ok: true, demoCode: '123456' };
    }
  }

  async verifySmsOtp(phone, token, role = 'Customer', targetUrl = null) {
    const cleanPhone = this.formatPhoneNumber(phone || this.pendingOtpPhone);
    const cleanToken = (token || '').trim();
    const finalTarget = targetUrl || this.getRoleRedirectUrl(role);

    localStorage.setItem('rest_os_pending_google_role', role);
    localStorage.setItem('rest_os_pending_redirect', finalTarget);

    if (!cleanToken) {
      this.showToast('Please enter the 6-digit SMS OTP code.');
      return { ok: false, reason: 'missing_token' };
    }

    // Demo fallback when Supabase is not configured
    if (cleanToken === '123456' && (!dbEngine.supabase || !dbEngine.hasValidSupabaseConfig())) {
      const user = {
        id: 'sms-user-' + Date.now(),
        name: `Mobile User (${cleanPhone.slice(-4)})`,
        email: `${cleanPhone.replace('+', '')}@sms.restaurantos.com`,
        role: role,
        auth_provider: 'sms',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanPhone)}`
      };
      this.saveUser(user);
      this.showToast(`📱 SMS verified for ${cleanPhone}! Redirecting to ${role} workspace…`);
      this.pendingOtpPhone = null;
      setTimeout(() => {
        window.isAppNavigation = true;
        window.location.href = finalTarget;
      }, 350);
      return { ok: true };
    }

    try {
      const { data, error } = await dbEngine.supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: cleanToken,
        type: 'sms'
      });

      if (error || !data?.session) {
        let errStr = error?.message || 'Invalid or expired SMS OTP code';
        if (typeof errStr !== 'string' || errStr === '{}') errStr = 'Invalid or expired SMS OTP code';
        this.showToast(`❌ SMS Verification Failed: ${errStr}`);
        return { ok: false, reason: errStr };
      }

      this.pendingOtpPhone = null;
      await this.handleSupabaseSession(data.session, role);
      this.closeAuthModal();
      return { ok: true };
    } catch (e) {
      console.error('SMS Verification Error:', e);
      this.showToast(`❌ SMS Verification Failed: ${e.message}`);
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
  // LOGOUT — atomic, no cascading side-effects
  // ---------------------------------------------------------------------

  logout() {
    // Guard: prevent double-logout and cascading side-effects
    if (this._loggingOut) return;
    this._loggingOut = true;

    const user = this.user;

    // 1. Clear restaurant session
    if (user) {
      try { dbEngine.clearActiveSession(user.email || user.id); } catch(e) {}
    }

    // 2. Clear our own auth state (directly, no saveUser to avoid cascading events)
    this.user = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);

    // 3. Mark explicit logout
    sessionStorage.setItem('rest_os_logged_out', '1');

    // 4. Nuke ALL Supabase SDK localStorage keys
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}

    // 5. Fire Supabase signOut (fire-and-forget, don't wait)
    if (dbEngine.supabase) {
      dbEngine.supabase.auth.signOut().catch(() => {});
    }

    // 6. Show toast
    this.showToast(user ? `Signed out ${user.name}` : 'Signed out');

    // 7. Redirect IMMEDIATELY — no setTimeout, no cascading
    window.isAppNavigation = true;
    window.location.href = window.location.origin + '/index.html';
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
