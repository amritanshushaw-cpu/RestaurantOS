/**
 * RestaurantOS - Mobile Phone WhatsApp OTP Sign-In Modal
 * Real-time WhatsApp OTP Verification via Supabase Cloud backend.
 */

import { authService } from '../services/authService.js';

export function openMobileAuthModal(targetRole = 'Customer', targetUrl = null) {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="auth-modal" class="sentry-modal-overlay">
      <div class="sentry-modal-content google-auth-modal-card" style="max-width: 480px; border-color: rgba(37, 211, 102, 0.4); box-shadow: 0 12px 40px rgba(37, 211, 102, 0.15);">
        <div class="google-modal-header">
          <div>
            <span class="badge sandbox-badge" style="background: rgba(37, 211, 102, 0.15); color: #25D366; font-size: 11px; margin-bottom: 6px; border: 1px solid rgba(37, 211, 102, 0.3);">
              <i class="fa-brands fa-whatsapp" style="font-size: 13px;"></i> REAL-TIME WHATSAPP OTP
            </span>
            <h3 class="google-modal-title">Sign in with WhatsApp Number (${targetRole} Mode)</h3>
            <p class="google-modal-subtitle" id="mobile-auth-step-label">Enter your mobile phone number to receive a 6-digit WhatsApp OTP code</p>
          </div>
          <button class="modal-close-btn" id="close-mobile-auth-modal">&times;</button>
        </div>

        <div id="mobile-auth-step-1" class="google-custom-login-box" style="margin: 16px 0;">
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <select id="country-code-select" class="sentry-input-sm" style="width: 100px; padding: 10px; font-family: var(--font-mono); font-weight: 700;">
              <option value="+91">🇮🇳 +91</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+61">🇦🇺 +61</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+49">🇩🇪 +49</option>
            </select>
            <input type="tel" id="mobile-auth-input" placeholder="98765 43210" class="sentry-input-sm" style="flex: 1; font-family: var(--font-mono); font-size: 14px; letter-spacing: 1px;">
          </div>
          <button id="btn-send-mobile-otp" class="btn-sentry" style="width: 100%; padding: 13px; font-weight: 700; background: linear-gradient(135deg, #25D366, #128C7E); color: #ffffff; border: none; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.35); transition: all 0.2s ease;">
            <i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> Send WhatsApp Code
          </button>
        </div>

        <div id="mobile-auth-step-2" class="google-custom-login-box" style="display:none; margin: 16px 0;">
          <div style="margin-bottom: 12px;">
            <input type="text" id="mobile-otp-code-input" placeholder="Enter 6-digit OTP code" maxlength="6" class="sentry-input-sm" style="font-family: var(--font-mono); font-size: 18px; text-align: center; letter-spacing: 6px;">
          </div>
          <button id="btn-verify-mobile-otp" class="btn-sentry" style="width: 100%; padding: 13px; font-weight: 700; background: linear-gradient(135deg, #25D366, #10b981); color: #000000; border: none; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.4);">
            <i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> Verify WhatsApp OTP & Sign In
          </button>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
            <button id="btn-resend-mobile-otp" class="btn-ghost-sm" style="font-size: 12px; color: #25D366;">
              <i class="fa-solid fa-rotate-right"></i> Resend WhatsApp Code
            </button>
            <button id="btn-back-mobile-step1" class="btn-ghost-sm" style="font-size: 12px; color: var(--text-tertiary);">
              <i class="fa-solid fa-arrow-left"></i> Change Number
            </button>
          </div>
        </div>

        <div class="google-modal-footer" style="text-align: center; border-top: 1px dashed var(--border-violet); padding-top: 12px; margin-top: 12px;">
          <span style="font-size: 11px; color: var(--text-tertiary);">
            ⚡ Powered by Supabase Cloud WhatsApp Auth · Demo verification code <strong>654321</strong>
          </span>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('auth-modal');
  let currentFullPhone = '';

  document.getElementById('close-mobile-auth-modal')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  async function sendOtp() {
    const code = document.getElementById('country-code-select').value;
    const rawNumber = document.getElementById('mobile-auth-input').value.trim();
    if (!rawNumber) {
      authService.showToast('Please enter your mobile phone number.');
      return;
    }

    currentFullPhone = rawNumber.startsWith('+') ? rawNumber : `${code}${rawNumber}`;
    const btn = document.getElementById('btn-send-mobile-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching WhatsApp Code...';

    const result = await authService.sendPhoneOtp(currentFullPhone);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> Send WhatsApp Code';

    if (result.ok) {
      document.getElementById('mobile-auth-step-1').style.display = 'none';
      document.getElementById('mobile-auth-step-2').style.display = 'block';
      document.getElementById('mobile-auth-step-label').textContent = `Enter the 6-digit WhatsApp code sent to ${currentFullPhone}`;
      document.getElementById('mobile-otp-code-input').focus();
    }
  }

  async function verifyOtp() {
    const token = document.getElementById('mobile-otp-code-input').value.trim();
    if (!token) {
      authService.showToast('Please enter the 6-digit WhatsApp OTP code.');
      return;
    }
    const btn = document.getElementById('btn-verify-mobile-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

    const result = await authService.verifyPhoneOtp(currentFullPhone, token, targetRole, targetUrl);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> Verify WhatsApp OTP & Sign In';

    if (result.ok) {
      if (targetRole) authService.setUserRole(targetRole);
      if (document.getElementById('auth-modal')) document.getElementById('auth-modal').remove();
    }
  }

  document.getElementById('btn-send-mobile-otp')?.addEventListener('click', sendOtp);
  document.getElementById('btn-verify-mobile-otp')?.addEventListener('click', verifyOtp);
  document.getElementById('btn-resend-mobile-otp')?.addEventListener('click', sendOtp);
  document.getElementById('btn-back-mobile-step1')?.addEventListener('click', () => {
    document.getElementById('mobile-auth-step-2').style.display = 'none';
    document.getElementById('mobile-auth-step-1').style.display = 'block';
    document.getElementById('mobile-auth-step-label').textContent = 'Enter your mobile phone number to receive a 6-digit WhatsApp OTP code';
  });
}
