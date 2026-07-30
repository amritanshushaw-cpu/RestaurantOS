/**
 * RestaurantOS - Email + Password + OTP Authentication Modal
 * Three-step flow:
 *   Step 1: Enter email + password → signUp or signIn
 *   Step 2: Supabase sends OTP to email (built-in mailer, no domain needed)
 *   Step 3: User enters OTP → verifyOtp → session created → redirect
 *
 * Works for ALL users worldwide using Supabase's built-in email service.
 */

import { authService } from '../services/authService.js';

export function openEmailAuthModal(targetRole = 'Customer', targetUrl = null) {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const roleColor = targetRole === 'Customer' ? 'var(--color-accent-lime)' :
                    targetRole === 'Waiter' ? '#ec4899' :
                    targetRole === 'Kitchen' ? '#3b82f6' : 'var(--color-accent-violet)';

  const modalHtml = `
    <div id="auth-modal" class="sentry-modal-overlay" style="z-index: 9999;">
      <div class="sentry-modal-content google-auth-modal-card" style="max-width: 440px; border-color: ${roleColor};">
        <div class="google-modal-header">
          <div>
            <span class="entry-badge" style="background:${roleColor}20; color:${roleColor}; border:1px solid ${roleColor}40; margin-bottom:6px; display:inline-block;">
              <i class="fa-solid fa-shield-halved"></i> ${targetRole.toUpperCase()} AUTH
            </span>
            <h3 class="google-modal-title" style="margin-top:4px;">Email + Password + OTP</h3>
            <p class="google-modal-subtitle" id="email-auth-step-label">Enter your credentials to continue</p>
          </div>
          <button class="modal-close-btn" id="close-email-auth-modal">&times;</button>
        </div>

        <div id="email-auth-error" style="display:none; background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; border-radius:8px; padding:10px 14px; font-size:12px; margin-top:12px; font-weight:600;"></div>

        <!-- Step 1: Email + Password -->
        <div id="email-auth-step-1" class="google-custom-login-box" style="margin:16px 0;">
          <div class="custom-login-inputs" style="display:flex; flex-direction:column; gap:10px;">
            <input type="email" id="email-auth-input" placeholder="you@example.com" class="sentry-input-sm" style="font-weight:600;" autocomplete="email">
            <input type="password" id="password-auth-input" placeholder="Password (min 6 characters)" class="sentry-input-sm" style="font-weight:600;" autocomplete="current-password">
            <button id="btn-send-otp" class="btn-sentry btn-sentry-sm" style="width:100%; margin-top:6px; justify-content:center; background:${roleColor}; color:#000; font-weight:700;">
              <i class="fa-solid fa-paper-plane"></i> Continue & Send OTP
            </button>
          </div>
          <p style="font-size:11px; color:var(--text-tertiary); margin-top:10px; text-align:center;">New user? Enter any email + a new password to sign up.<br>Existing user? Enter your registered credentials.</p>
        </div>

        <!-- Step 2: OTP Verification -->
        <div id="email-auth-step-2" class="google-custom-login-box" style="display:none; margin:16px 0;">
          <div class="custom-login-inputs" style="display:flex; flex-direction:column; gap:10px;">
            <input type="text" id="otp-code-input" placeholder="Enter OTP code" maxlength="10" class="sentry-input-sm" style="text-align:center; font-size:20px; letter-spacing:6px; font-weight:700;" autocomplete="one-time-code">
            <button id="btn-verify-otp" class="btn-sentry btn-sentry-sm" style="width:100%; margin-top:6px; justify-content:center; background:${roleColor}; color:#000; font-weight:700;">
              <i class="fa-solid fa-check-double"></i> Verify OTP & Sign In
            </button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <button id="btn-resend-otp" class="btn-ghost-sm" style="font-size:12px;" disabled>Resend OTP</button>
            <span id="email-timer-label" style="font-size:12px; color:var(--text-tertiary);">Wait 30s</span>
          </div>
          <button id="btn-back-step1" class="btn-ghost-sm" style="font-size:12px; margin-top:6px; width:100%; text-align:center;">
            <i class="fa-solid fa-arrow-left"></i> Back to Email & Password
          </button>
        </div>

        <div class="google-modal-footer" style="text-align:center; font-size:11px; color:var(--text-tertiary);">
          <span>Secured by Supabase Auth · OTP sent to your email</span>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('auth-modal');
  let currentEmail = '';
  let currentPassword = '';
  let resendTimer = null;

  // --- Utility functions ---
  function clearTimer() {
    if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
  }

  function showError(msg) {
    const errBox = document.getElementById('email-auth-error');
    if (!errBox) return;
    if (msg) { errBox.textContent = msg; errBox.style.display = 'block'; }
    else { errBox.style.display = 'none'; }
  }

  function startResendCountdown() {
    let secondsLeft = 30;
    const btnResend = document.getElementById('btn-resend-otp');
    const timerLabel = document.getElementById('email-timer-label');
    if (btnResend) btnResend.disabled = true;
    clearTimer();
    resendTimer = setInterval(() => {
      secondsLeft--;
      if (timerLabel) timerLabel.textContent = `Wait ${secondsLeft}s`;
      if (secondsLeft <= 0) {
        clearTimer();
        if (btnResend) btnResend.disabled = false;
        if (timerLabel) timerLabel.textContent = 'Ready';
      }
    }, 1000);
  }

  // --- Close handlers ---
  document.getElementById('close-email-auth-modal')?.addEventListener('click', () => { clearTimer(); modal.remove(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) { clearTimer(); modal.remove(); } });

  // --- Back button ---
  document.getElementById('btn-back-step1')?.addEventListener('click', () => {
    showError('');
    document.getElementById('email-auth-step-2').style.display = 'none';
    document.getElementById('email-auth-step-1').style.display = 'block';
    document.getElementById('email-auth-step-label').textContent = 'Enter your credentials to continue';
    clearTimer();
  });

  // --- Step 1: Email + Password → Send OTP ---
  async function sendCode() {
    showError('');
    const email = (document.getElementById('email-auth-input')?.value || '').trim().toLowerCase();
    const password = (document.getElementById('password-auth-input')?.value || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    currentEmail = email;
    currentPassword = password;

    const btn = document.getElementById('btn-send-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    const result = await authService.sendEmailPasswordOtp(email, password);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Continue & Send OTP';

    if (result.ok) {
      if (result.directSignIn && result.session) {
        // Existing user — password verified, sign in directly (no OTP needed)
        clearTimer();
        modal.remove();
        await authService.handleSupabaseSession(result.session, targetRole);
        const finalTarget = targetUrl || authService.getRoleRedirectUrl(targetRole);
        authService.showToast(`Signed in as ${targetRole}! Redirecting...`);
        setTimeout(() => {
          window.isAppNavigation = true;
          window.location.href = finalTarget;
        }, 400);
      } else {
        // New user — OTP sent, move to verification step
        document.getElementById('email-auth-step-1').style.display = 'none';
        document.getElementById('email-auth-step-2').style.display = 'block';
        document.getElementById('email-auth-step-label').textContent = `Enter the OTP code sent to ${email}`;
        document.getElementById('otp-code-input')?.focus();
        startResendCountdown();
      }
    } else {
      showError(result.reason || 'Could not process. Please try again.');
    }
  }

  // --- Step 2: Verify OTP ---
  async function verifyCode() {
    showError('');
    const tokenInput = (document.getElementById('otp-code-input')?.value || '').trim();

    if (!tokenInput) {
      showError('Please enter the OTP verification code from your email.');
      return;
    }

    const btn = document.getElementById('btn-verify-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

    const result = await authService.verifyEmailOtp(currentEmail, tokenInput, targetRole, targetUrl);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Verify OTP & Sign In';

    if (result.ok) {
      clearTimer();
      modal.remove();
      const finalTarget = targetUrl || authService.getRoleRedirectUrl(targetRole);
      authService.showToast(`Authenticated as ${targetRole}! Redirecting...`);
      setTimeout(() => {
        window.isAppNavigation = true;
        window.location.href = finalTarget;
      }, 400);
    } else {
      showError(result.reason || 'Verification failed. Check the code and try again.');
    }
  }

  // --- Resend OTP (re-sends with same email+password) ---
  async function resendCode() {
    showError('');
    if (!currentEmail || !currentPassword) return;
    const btn = document.getElementById('btn-resend-otp');
    btn.disabled = true;
    const result = await authService.sendEmailPasswordOtp(currentEmail, currentPassword);
    if (result.ok) {
      authService.showToast(`OTP re-sent to ${currentEmail}`);
      startResendCountdown();
    } else {
      showError(result.reason || 'Could not resend OTP.');
      btn.disabled = false;
    }
  }

  // --- Event listeners ---
  document.getElementById('btn-send-otp')?.addEventListener('click', sendCode);
  document.getElementById('btn-verify-otp')?.addEventListener('click', verifyCode);
  document.getElementById('btn-resend-otp')?.addEventListener('click', resendCode);

  // Allow Enter key to submit in each step
  document.getElementById('password-auth-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCode(); });
  document.getElementById('email-auth-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('password-auth-input')?.focus(); });
  document.getElementById('otp-code-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyCode(); });
}
