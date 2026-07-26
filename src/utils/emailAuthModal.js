/**
 * RestaurantOS - Real Supabase Authentication Modal
 * Supports:
 *  1. Google OAuth (via Supabase Auth)
 *  2. Real Email & Password Sign In / Sign Up (Supabase GoTrue)
 *  3. Real Email OTP Verification Code (Supabase Auth)
 */

import { authService } from '../services/authService.js';

export function openEmailAuthModal(defaultTab = 'email') {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="auth-modal" class="sentry-modal-overlay">
      <div class="sentry-modal-content google-auth-modal-card" style="max-width: 480px; width: 92%;">
        <div class="google-modal-header">
          <div>
            <h3 class="google-modal-title">Supabase Authentication</h3>
            <p class="google-modal-subtitle">Sign in or register using your Supabase backend credentials</p>
          </div>
          <button class="modal-close-btn" id="close-email-auth-modal">&times;</button>
        </div>

        <!-- Auth Method Selector Tabs -->
        <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-violet); margin-bottom: 16px; padding-bottom: 8px;">
          <button type="button" class="auth-tab-btn active" data-tab="pass" style="background: none; border: none; color: var(--color-accent-lime); font-size: 13px; font-weight: 700; cursor: pointer; padding: 6px 12px; border-bottom: 2px solid var(--color-accent-lime);">
            Password
          </button>
          <button type="button" class="auth-tab-btn" data-tab="otp" style="background: none; border: none; color: var(--text-secondary); font-size: 13px; font-weight: 700; cursor: pointer; padding: 6px 12px;">
            Email OTP Code
          </button>
        </div>

        <!-- Method A: Password Sign In / Sign Up -->
        <div id="auth-tab-pass-content">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <input type="text" id="auth-fullname-input" placeholder="Full Name (optional for sign up)" class="sentry-input-sm">
            <input type="email" id="auth-email-input" placeholder="name@domain.com" class="sentry-input-sm" required>
            <input type="password" id="auth-password-input" placeholder="Password (min 6 chars)" class="sentry-input-sm" required>

            <div style="display: flex; gap: 10px; margin-top: 6px;">
              <button id="btn-email-signin" class="btn-sentry btn-sentry-sm" style="flex: 1;">
                <i class="fa-solid fa-right-to-bracket"></i> Sign In
              </button>
              <button id="btn-email-signup" class="btn-ghost-sm" style="flex: 1; border: 1px solid var(--border-violet);">
                <i class="fa-solid fa-user-plus"></i> Create Account
              </button>
            </div>
          </div>
        </div>

        <!-- Method B: Email OTP Code -->
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
                <i class="fa-solid fa-check"></i> Verify Code & Sign In
              </button>
            </div>
            <button id="btn-resend-otp" class="btn-ghost-sm" style="margin-top:8px;">Resend Code</button>
          </div>
        </div>

        <!-- Divider -->
        <div style="display: flex; align-items: center; margin: 18px 0; color: var(--text-tertiary); font-size: 11px;">
          <div style="flex:1; height:1px; background: var(--border-violet);"></div>
          <span style="padding: 0 10px; text-transform: uppercase;">OR CONTINUED WITH</span>
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
          <strong style="color: var(--text-primary);">Sign in with Google OAuth</strong>
        </button>

        <div class="google-modal-footer" style="margin-top: 16px; text-align: center; font-size: 11px; color: var(--text-tertiary);">
          Protected by Supabase Authentication & Real GoTrue Service
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('auth-modal');
  let currentOtpEmail = '';

  document.getElementById('close-email-auth-modal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

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
      if (tab === 'pass') {
        document.getElementById('auth-tab-pass-content').style.display = 'block';
        document.getElementById('auth-tab-otp-content').style.display = 'none';
      } else {
        document.getElementById('auth-tab-pass-content').style.display = 'none';
        document.getElementById('auth-tab-otp-content').style.display = 'block';
      }
    });
  });

  // Password Sign In Action
  document.getElementById('btn-email-signin')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email-input').value.trim();
    const password = document.getElementById('auth-password-input').value;
    const btn = document.getElementById('btn-email-signin');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

    const res = await authService.loginWithEmailPassword(email, password);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';

    if (res.ok && document.getElementById('auth-modal')) {
      document.getElementById('auth-modal').remove();
    }
  });

  // Password Sign Up Action
  document.getElementById('btn-email-signup')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email-input').value.trim();
    const password = document.getElementById('auth-password-input').value;
    const fullName = document.getElementById('auth-fullname-input').value.trim();
    const btn = document.getElementById('btn-email-signup');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    const res = await authService.signUpWithEmailPassword(email, password, fullName);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';

    if (res.ok && document.getElementById('auth-modal')) {
      document.getElementById('auth-modal').remove();
    }
  });

  // Google OAuth Button Action
  document.getElementById('btn-google-auth-trigger')?.addEventListener('click', () => {
    authService.loginWithGoogle();
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
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Verify Code & Sign In';
    if (result.ok && document.getElementById('auth-modal')) {
      document.getElementById('auth-modal').remove();
    }
  }

  document.getElementById('btn-send-otp')?.addEventListener('click', sendCode);
  document.getElementById('btn-verify-otp')?.addEventListener('click', verifyCode);
  document.getElementById('btn-resend-otp')?.addEventListener('click', sendCode);
}
