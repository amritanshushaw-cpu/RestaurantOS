/**
 * RestaurantOS - Email OTP Sign-In Modal
 * Two-step verification: send code -> verify code -> assign role -> redirect to target UI.
 */

import { authService } from '../services/authService.js';

export function openEmailAuthModal(targetRole = 'Customer', targetUrl = null) {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="auth-modal" class="sentry-modal-overlay">
      <div class="sentry-modal-content google-auth-modal-card">
        <div class="google-modal-header">
          <div>
            <h3 class="google-modal-title">Sign in with Email (${targetRole} Mode)</h3>
            <p class="google-modal-subtitle" id="email-auth-step-label">Enter your email to receive a verification code</p>
          </div>
          <button class="modal-close-btn" id="close-email-auth-modal">&times;</button>
        </div>

        <div id="email-auth-step-1" class="google-custom-login-box">
          <div class="custom-login-inputs">
            <input type="email" id="email-auth-input" placeholder="you@example.com" class="sentry-input-sm">
            <button id="btn-send-otp" class="btn-sentry btn-sentry-sm">
              <i class="fa-solid fa-paper-plane"></i> Send code
            </button>
          </div>
        </div>

        <div id="email-auth-step-2" class="google-custom-login-box" style="display:none;">
          <div class="custom-login-inputs">
            <input type="text" id="otp-code-input" placeholder="6-digit code" maxlength="6" class="sentry-input-sm">
            <button id="btn-verify-otp" class="btn-sentry btn-sentry-sm">
              <i class="fa-solid fa-check"></i> Verify & sign in
            </button>
          </div>
          <button id="btn-resend-otp" class="btn-ghost-sm" style="margin-top:8px;">Resend code</button>
        </div>

        <div class="google-modal-footer">
          <span>Verification handled by Supabase Auth · Demo code 123456 ready</span>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('auth-modal');
  let currentEmail = '';

  document.getElementById('close-email-auth-modal')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  async function sendCode() {
    const email = document.getElementById('email-auth-input').value.trim();
    if (!email) return;
    currentEmail = email;
    const btn = document.getElementById('btn-send-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    const result = await authService.sendEmailOtp(email);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send code';
    if (result.ok) {
      document.getElementById('email-auth-step-1').style.display = 'none';
      document.getElementById('email-auth-step-2').style.display = 'block';
      document.getElementById('email-auth-step-label').textContent = `Enter the code sent to ${email}`;
    }
  }

  async function verifyCode() {
    const token = document.getElementById('otp-code-input').value.trim();
    if (!token) return;
    const btn = document.getElementById('btn-verify-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    const result = await authService.verifyEmailOtp(currentEmail, token, targetRole, targetUrl);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Verify & sign in';
    if (result.ok) {
      if (targetRole) authService.setUserRole(targetRole);
      if (document.getElementById('auth-modal')) document.getElementById('auth-modal').remove();
      if (targetUrl) {
        authService.showToast(`Authenticated for ${targetRole} Mode. Redirecting...`);
        setTimeout(() => {
          window.isAppNavigation = true;
          window.location.href = targetUrl;
        }, 500);
      }
    }
  }

  document.getElementById('btn-send-otp')?.addEventListener('click', sendCode);
  document.getElementById('btn-verify-otp')?.addEventListener('click', verifyCode);
  document.getElementById('btn-resend-otp')?.addEventListener('click', sendCode);
}
