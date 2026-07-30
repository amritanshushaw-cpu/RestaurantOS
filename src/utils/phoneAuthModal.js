/**
 * RestaurantOS - Mobile Phone SMS OTP Sign-In Modal
 * Two-step verification: enter phone → receive SMS OTP → verify → assign role → redirect.
 * Uses Supabase Auth signInWithOtp (default SMS channel, NOT WhatsApp).
 */

import { authService } from '../services/authService.js';

export function openPhoneAuthModal(targetRole = 'Customer', targetUrl = null) {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="auth-modal" class="sentry-modal-overlay">
      <div class="sentry-modal-content google-auth-modal-card" style="max-width: 480px; border-color: rgba(6, 182, 212, 0.35); box-shadow: 0 12px 40px rgba(6, 182, 212, 0.12);">
        <div class="google-modal-header">
          <div>
            <span class="badge sandbox-badge" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; font-size: 11px; margin-bottom: 6px; border: 1px solid rgba(6, 182, 212, 0.3);">
              <i class="fa-solid fa-mobile-screen-button" style="font-size: 13px;"></i> REAL-TIME SMS OTP
            </span>
            <h3 class="google-modal-title">Sign in with Mobile Number (${targetRole} Mode)</h3>
            <p class="google-modal-subtitle" id="phone-auth-step-label">Enter your mobile phone number to receive a 6-digit SMS code</p>
          </div>
          <button class="modal-close-btn" id="close-phone-auth-modal">&times;</button>
        </div>

        <div id="phone-auth-step-1" class="google-custom-login-box" style="margin: 16px 0;">
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <select id="phone-country-code-select" class="sentry-input-sm" style="width: 105px; padding: 10px; font-family: var(--font-mono); font-weight: 700;">
              <option value="+91">🇮🇳 +91</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+65">🇸🇬 +65</option>
            </select>
            <input type="tel" id="phone-auth-input" placeholder="98765 43210" class="sentry-input-sm" style="flex: 1; font-family: var(--font-mono); font-size: 14px; letter-spacing: 1px;" maxlength="15">
          </div>
          <button id="btn-send-phone-otp" class="btn-sentry" style="width: 100%; padding: 13px; font-weight: 700; background: linear-gradient(135deg, #06b6d4, #0891b2); color: #ffffff; border: none; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.35); transition: all 0.2s ease;">
            <i class="fa-solid fa-paper-plane" style="font-size: 14px;"></i> Send SMS Code
          </button>
        </div>

        <div id="phone-auth-step-2" class="google-custom-login-box" style="display:none; margin: 16px 0;">
          <div style="margin-bottom: 12px;">
            <input type="text" id="phone-otp-code-input" placeholder="Enter 6-digit OTP code" maxlength="6" class="sentry-input-sm" style="font-family: var(--font-mono); font-size: 18px; text-align: center; letter-spacing: 6px;" inputmode="numeric" pattern="[0-9]*">
          </div>
          <button id="btn-verify-phone-otp" class="btn-sentry" style="width: 100%; padding: 13px; font-weight: 700; background: linear-gradient(135deg, #06b6d4, #10b981); color: #ffffff; border: none; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.4);">
            <i class="fa-solid fa-shield-halved" style="font-size: 14px;"></i> Verify SMS OTP & Sign In
          </button>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
            <button id="btn-resend-phone-otp" class="btn-ghost-sm" style="font-size: 12px; color: #06b6d4;" disabled>
              <i class="fa-solid fa-rotate-right"></i> Resend in <span id="phone-resend-timer">30</span>s
            </button>
            <button id="btn-back-phone-step1" class="btn-ghost-sm" style="font-size: 12px; color: var(--text-tertiary);">
              <i class="fa-solid fa-arrow-left"></i> Change Number
            </button>
          </div>
        </div>

        <div class="google-modal-footer" style="text-align: center; border-top: 1px dashed var(--border-violet); padding-top: 12px; margin-top: 12px;">
          <span style="font-size: 11px; color: var(--text-tertiary);">
            ⚡ SMS OTP Authentication powered by Supabase Cloud · Demo code <strong>123456</strong>
          </span>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('auth-modal');
  let currentFullPhone = '';
  let resendInterval = null;

  document.getElementById('close-phone-auth-modal')?.addEventListener('click', () => { clearInterval(resendInterval); modal.remove(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) { clearInterval(resendInterval); modal.remove(); } });

  function startResendCountdown() {
    let seconds = 30;
    const timerEl = document.getElementById('phone-resend-timer');
    const resendBtn = document.getElementById('btn-resend-phone-otp');
    if (resendBtn) resendBtn.disabled = true;
    if (timerEl) timerEl.textContent = seconds;

    clearInterval(resendInterval);
    resendInterval = setInterval(() => {
      seconds--;
      if (timerEl) timerEl.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(resendInterval);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Resend SMS Code';
        }
      }
    }, 1000);
  }

  function validatePhone(raw) {
    const digits = raw.replace(/[^\d]/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  async function sendOtp() {
    const code = document.getElementById('phone-country-code-select').value;
    const rawNumber = document.getElementById('phone-auth-input').value.trim();
    if (!rawNumber || !validatePhone(rawNumber)) {
      authService.showToast('Please enter a valid mobile phone number (7–15 digits).');
      return;
    }

    currentFullPhone = rawNumber.startsWith('+') ? rawNumber : `${code}${rawNumber.replace(/[^\d]/g, '')}`;
    const btn = document.getElementById('btn-send-phone-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending SMS Code...';

    const result = await authService.sendSmsOtp(currentFullPhone);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane" style="font-size: 14px;"></i> Send SMS Code';

    if (result.ok) {
      document.getElementById('phone-auth-step-1').style.display = 'none';
      document.getElementById('phone-auth-step-2').style.display = 'block';
      document.getElementById('phone-auth-step-label').textContent = `Enter the 6-digit SMS code sent to ${currentFullPhone}`;
      document.getElementById('phone-otp-code-input').focus();
      startResendCountdown();
    }
  }

  async function verifyOtp() {
    const token = document.getElementById('phone-otp-code-input').value.trim();
    if (!token || token.length < 6) {
      authService.showToast('Please enter the complete 6-digit SMS OTP code.');
      return;
    }
    const btn = document.getElementById('btn-verify-phone-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

    const result = await authService.verifySmsOtp(currentFullPhone, token, targetRole, targetUrl);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-shield-halved" style="font-size: 14px;"></i> Verify SMS OTP & Sign In';

    if (result.ok) {
      clearInterval(resendInterval);
      if (targetRole) authService.setUserRole(targetRole);
      if (document.getElementById('auth-modal')) document.getElementById('auth-modal').remove();
    }
  }

  document.getElementById('btn-send-phone-otp')?.addEventListener('click', sendOtp);
  document.getElementById('btn-verify-phone-otp')?.addEventListener('click', verifyOtp);
  document.getElementById('btn-resend-phone-otp')?.addEventListener('click', sendOtp);
  document.getElementById('btn-back-phone-step1')?.addEventListener('click', () => {
    clearInterval(resendInterval);
    document.getElementById('phone-auth-step-2').style.display = 'none';
    document.getElementById('phone-auth-step-1').style.display = 'block';
    document.getElementById('phone-auth-step-label').textContent = 'Enter your mobile phone number to receive a 6-digit SMS code';
  });

  // Allow Enter key submission
  document.getElementById('phone-auth-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendOtp(); });
  document.getElementById('phone-otp-code-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyOtp(); });
}
