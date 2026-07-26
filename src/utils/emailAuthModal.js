/**
 * RestaurantOS - Real Supabase Authentication Modal
 * Supports Sign Up & Login with Role Selection:
 *  - Customer
 *  - Manager / Owner
 *  - Waiter
 *  - Kitchen Staff
 * Via both Email + Password / OTP AND Google OAuth.
 */

import { authService } from '../services/authService.js';

export function openEmailAuthModal(defaultRole = 'Customer') {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="auth-modal" class="sentry-modal-overlay">
      <div class="sentry-modal-content google-auth-modal-card" style="max-width: 520px; width: 92%;">
        <div class="google-modal-header">
          <div>
            <h3 class="google-modal-title"><i class="fa-solid fa-user-shield" style="color: var(--color-accent-lime);"></i> Supabase Authentication</h3>
            <p class="google-modal-subtitle">Sign in or register your account with role-based access</p>
          </div>
          <button class="modal-close-btn" id="close-email-auth-modal">&times;</button>
        </div>

        <!-- Role Selector Pills -->
        <div style="margin-bottom: 16px;">
          <label style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 6px;">
            Select Access Role:
          </label>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;" id="auth-role-pills">
            <button type="button" class="btn-role-opt ${defaultRole === 'Customer' ? 'active' : ''}" data-role="Customer" style="background: var(--color-primary); border: 1px solid ${defaultRole === 'Customer' ? 'var(--color-accent-lime)' : 'var(--border-violet)'}; color: #fff; padding: 6px; border-radius: var(--radius-md); font-size: 11px; font-weight: 700; cursor: pointer;">
              <i class="fa-solid fa-user"></i> Customer
            </button>
            <button type="button" class="btn-role-opt ${defaultRole === 'Manager' ? 'active' : ''}" data-role="Manager" style="background: var(--color-primary); border: 1px solid ${defaultRole === 'Manager' ? 'var(--color-accent-lime)' : 'var(--border-violet)'}; color: #fff; padding: 6px; border-radius: var(--radius-md); font-size: 11px; font-weight: 700; cursor: pointer;">
              <i class="fa-solid fa-user-tie"></i> Manager
            </button>
            <button type="button" class="btn-role-opt ${defaultRole === 'Waiter' ? 'active' : ''}" data-role="Waiter" style="background: var(--color-primary); border: 1px solid ${defaultRole === 'Waiter' ? 'var(--color-accent-lime)' : 'var(--border-violet)'}; color: #fff; padding: 6px; border-radius: var(--radius-md); font-size: 11px; font-weight: 700; cursor: pointer;">
              <i class="fa-solid fa-concierge-bell"></i> Waiter
            </button>
            <button type="button" class="btn-role-opt ${defaultRole === 'Kitchen' ? 'active' : ''}" data-role="Kitchen" style="background: var(--color-primary); border: 1px solid ${defaultRole === 'Kitchen' ? 'var(--color-accent-lime)' : 'var(--border-violet)'}; color: #fff; padding: 6px; border-radius: var(--radius-md); font-size: 11px; font-weight: 700; cursor: pointer;">
              <i class="fa-solid fa-utensils"></i> Kitchen
            </button>
          </div>
        </div>

        <!-- Auth Method Selector Tabs (Sign In / Sign Up / OTP) -->
        <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-violet); margin-bottom: 16px; padding-bottom: 8px;">
          <button type="button" class="auth-tab-btn active" data-tab="signin" style="background: none; border: none; color: var(--color-accent-lime); font-size: 13px; font-weight: 700; cursor: pointer; padding: 6px 12px; border-bottom: 2px solid var(--color-accent-lime);">
            Sign In
          </button>
          <button type="button" class="auth-tab-btn" data-tab="signup" style="background: none; border: none; color: var(--text-secondary); font-size: 13px; font-weight: 700; cursor: pointer; padding: 6px 12px;">
            Create Account
          </button>
          <button type="button" class="auth-tab-btn" data-tab="otp" style="background: none; border: none; color: var(--text-secondary); font-size: 13px; font-weight: 700; cursor: pointer; padding: 6px 12px;">
            Email OTP
          </button>
        </div>

        <!-- Tab 1: Sign In -->
        <div id="auth-tab-signin-content">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <input type="email" id="auth-signin-email" placeholder="Email address" class="sentry-input-sm" required>
            <input type="password" id="auth-signin-pass" placeholder="Password" class="sentry-input-sm" required>

            <button id="btn-do-signin" class="btn-sentry btn-sentry-sm" style="width: 100%; margin-top: 4px;">
              <i class="fa-solid fa-right-to-bracket"></i> Sign In to Account
            </button>
          </div>
        </div>

        <!-- Tab 2: Create Account / Sign Up -->
        <div id="auth-tab-signup-content" style="display: none;">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <input type="text" id="auth-signup-name" placeholder="Full Name (e.g. Rahul Sharma)" class="sentry-input-sm" required>
            <input type="email" id="auth-signup-email" placeholder="Email address" class="sentry-input-sm" required>
            <input type="password" id="auth-signup-pass" placeholder="Create Password (min 6 chars)" class="sentry-input-sm" required>

            <button id="btn-do-signup" class="btn-sentry btn-sentry-sm" style="width: 100%; margin-top: 4px; background: var(--color-accent-pink);">
              <i class="fa-solid fa-user-plus"></i> Create Account & Register Role
            </button>
          </div>
        </div>

        <!-- Tab 3: Email OTP Code -->
        <div id="auth-tab-otp-content" style="display: none;">
          <div id="email-auth-step-1" class="google-custom-login-box">
            <div class="custom-login-inputs">
              <input type="email" id="email-otp-input" placeholder="you@example.com" class="sentry-input-sm">
              <button id="btn-send-otp" class="btn-sentry btn-sentry-sm">
                <i class="fa-solid fa-paper-plane"></i> Send OTP Code
              </button>
            </div>
          </div>

          <div id="email-auth-step-2" class="google-custom-login-box" style="display:none; margin-top: 12px;">
            <div class="custom-login-inputs">
              <input type="text" id="otp-code-input" placeholder="6-digit verification code" maxlength="6" class="sentry-input-sm">
              <button id="btn-verify-otp" class="btn-sentry btn-sentry-sm">
                <i class="fa-solid fa-check"></i> Verify & Sign In
              </button>
            </div>
            <button id="btn-resend-otp" class="btn-ghost-sm" style="margin-top:8px;">Resend Code</button>
          </div>
        </div>

        <!-- Divider -->
        <div style="display: flex; align-items: center; margin: 18px 0; color: var(--text-tertiary); font-size: 11px;">
          <div style="flex:1; height:1px; background: var(--border-violet);"></div>
          <span style="padding: 0 10px; text-transform: uppercase;">OR SIGN IN WITH GOOGLE</span>
          <div style="flex:1; height:1px; background: var(--border-violet);"></div>
        </div>

        <!-- Google OAuth Button -->
        <button id="btn-google-auth-trigger" type="button" class="btn-ghost-sm" style="width: 100%; padding: 10px; border: 1px solid var(--border-violet); display: flex; align-items: center; justify-content: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <strong style="color: var(--text-primary);">Google OAuth (Sign In / Register)</strong>
        </button>

        <div class="google-modal-footer" style="margin-top: 16px; text-align: center; font-size: 11px; color: var(--text-tertiary);">
          Supabase Auth Engine · Role Selection Sync Enabled
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('auth-modal');
  let selectedRole = defaultRole;
  let currentOtpEmail = '';

  document.getElementById('close-email-auth-modal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  // Role Pill Selection
  modal.querySelectorAll('.btn-role-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.btn-role-opt').forEach(b => b.style.borderColor = 'var(--border-violet)');
      btn.style.borderColor = 'var(--color-accent-lime)';
      selectedRole = btn.dataset.role;
    });
  });

  // Tab Switching
  modal.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.auth-tab-btn').forEach(b => {
        b.style.color = 'var(--text-secondary)';
        b.style.borderBottom = 'none';
      });
      btn.style.color = 'var(--color-accent-lime)';
      btn.style.borderBottom = '2px solid var(--color-accent-lime)';

      const tab = btn.dataset.tab;
      document.getElementById('auth-tab-signin-content').style.display = tab === 'signin' ? 'block' : 'none';
      document.getElementById('auth-tab-signup-content').style.display = tab === 'signup' ? 'block' : 'none';
      document.getElementById('auth-tab-otp-content').style.display = tab === 'otp' ? 'block' : 'none';
    });
  });

  // Sign In Action
  document.getElementById('btn-do-signin')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-signin-email').value.trim();
    const password = document.getElementById('auth-signin-pass').value;
    const btn = document.getElementById('btn-do-signin');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

    const res = await authService.loginWithEmailPassword(email, password, selectedRole);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Account';

    if (res.ok && document.getElementById('auth-modal')) {
      document.getElementById('auth-modal').remove();
    }
  });

  // Sign Up Action
  document.getElementById('btn-do-signup')?.addEventListener('click', async () => {
    const fullName = document.getElementById('auth-signup-name').value.trim();
    const email = document.getElementById('auth-signup-email').value.trim();
    const password = document.getElementById('auth-signup-pass').value;
    const btn = document.getElementById('btn-do-signup');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';

    const res = await authService.signUpWithEmailPassword(email, password, fullName, selectedRole);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account & Register Role';

    if (res.ok && document.getElementById('auth-modal')) {
      document.getElementById('auth-modal').remove();
    }
  });

  // Google OAuth Button Action
  document.getElementById('btn-google-auth-trigger')?.addEventListener('click', () => {
    authService.loginWithGoogle(selectedRole);
  });

  // OTP Send Action
  async function sendCode() {
    const email = document.getElementById('email-otp-input').value.trim();
    if (!email) return;
    currentOtpEmail = email;
    const btn = document.getElementById('btn-send-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    const result = await authService.sendEmailOtp(email);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP Code';
    if (result.ok) {
      document.getElementById('email-auth-step-1').style.display = 'none';
      document.getElementById('email-auth-step-2').style.display = 'block';
    }
  }

  // OTP Verify Action
  async function verifyCode() {
    const token = document.getElementById('otp-code-input').value.trim();
    if (!token) return;
    const btn = document.getElementById('btn-verify-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    const result = await authService.verifyEmailOtp(currentOtpEmail, token);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Verify & Sign In';
    if (result.ok && document.getElementById('auth-modal')) {
      document.getElementById('auth-modal').remove();
    }
  }

  document.getElementById('btn-send-otp')?.addEventListener('click', sendCode);
  document.getElementById('btn-verify-otp')?.addEventListener('click', verifyCode);
  document.getElementById('btn-resend-otp')?.addEventListener('click', sendCode);
}
