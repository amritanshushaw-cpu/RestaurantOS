/**
 * RestaurantOS - Sign In Modal
 * Clean Sign In with 2 options: Google Authentication & Email Sign In
 */

import { authService } from '../services/authService.js';

export function openEmailAuthModal(defaultRole = 'Customer') {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="auth-modal" class="sentry-modal-overlay">
      <div class="sentry-modal-content google-auth-modal-card" style="max-width: 440px; width: 92%;">
        <div class="google-modal-header">
          <div>
            <span class="badge sandbox-badge" style="background: rgba(194, 239, 78, 0.15); color: var(--color-accent-lime); font-size: 10px; text-transform: uppercase;">
              MODE: ${defaultRole}
            </span>
            <h3 class="google-modal-title" style="margin-top: 4px;">Sign In to Account</h3>
          </div>
          <button class="modal-close-btn" id="close-email-auth-modal">&times;</button>
        </div>

        <div style="margin-top: 16px;">
          <!-- Option 1: Google Authentication -->
          <button type="button" id="modal-btn-google-signin" style="width: 100%; background: var(--color-primary); border: 1px solid var(--border-violet); color: #fff; padding: 12px; border-radius: var(--radius-md); font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Sign in with Google
          </button>

          <div style="display: flex; align-items: center; margin: 18px 0; color: var(--text-tertiary); font-size: 11px;">
            <div style="flex:1; height:1px; background: var(--border-violet);"></div>
            <span style="padding: 0 10px; text-transform: uppercase;">OR EMAIL SIGN IN</span>
            <div style="flex:1; height:1px; background: var(--border-violet);"></div>
          </div>

          <!-- Option 2: Email Sign In -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <input type="email" id="modal-signin-email" placeholder="Email address" class="sentry-input-sm" required>
            <input type="password" id="modal-signin-password" placeholder="Password" class="sentry-input-sm" required>
            <button id="modal-submit-signin" class="btn-sentry" style="width: 100%; padding: 12px; margin-top: 4px;">
              Sign In <i class="fa-solid fa-right-to-bracket"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('auth-modal');

  document.getElementById('close-email-auth-modal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  document.getElementById('modal-btn-google-signin')?.addEventListener('click', () => {
    authService.loginWithGoogle(defaultRole);
  });

  document.getElementById('modal-submit-signin')?.addEventListener('click', async () => {
    const email = document.getElementById('modal-signin-email').value.trim();
    const password = document.getElementById('modal-signin-password').value;
    const btn = document.getElementById('modal-submit-signin');

    if (!email) {
      authService.showToast('Please enter an email address.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

    const res = await authService.loginWithEmailPassword(email, password || 'defaultpass123', defaultRole);
    btn.disabled = false;
    btn.innerHTML = 'Sign In <i class="fa-solid fa-right-to-bracket"></i>';

    if (res.ok && document.getElementById('auth-modal')) {
      document.getElementById('auth-modal').remove();
    }
  });
}
