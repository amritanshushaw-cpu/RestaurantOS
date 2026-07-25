/**
 * RestaurantOS - Main Application Controller
 * Connects DOM UI elements with validation utilities and PaymentEngine service.
 */

import { detectCardBrand, formatCardNumber, formatExpiryDate } from './utils/validation.js';
import { PaymentEngine } from './services/paymentEngine.js';

document.addEventListener('DOMContentLoaded', () => {
  const engine = new PaymentEngine();

  // DOM Elements
  const creditCard = document.getElementById('credit-card');
  const cardHolderInput = document.getElementById('card-holder-input');
  const cardNumberInput = document.getElementById('card-number-input');
  const cardExpiryInput = document.getElementById('card-expiry-input');
  const cardCvvInput = document.getElementById('card-cvv-input');

  const cardHolderDisplay = document.getElementById('card-holder-display');
  const cardNumberDisplay = document.getElementById('card-number-display');
  const cardExpiryDisplay = document.getElementById('card-expiry-display');
  const cardCvvDisplay = document.getElementById('card-cvv-display');
  const cardBrandLogo = document.getElementById('card-brand-logo');

  const paymentForm = document.getElementById('payment-form');
  const processingModal = document.getElementById('processing-modal');
  const processingStatus = document.getElementById('processing-status');

  const otpModal = document.getElementById('otp-modal');
  const otpInput = document.getElementById('otp-input');
  const btnSubmitOtp = document.getElementById('btn-submit-otp');

  const checkoutGrid = document.getElementById('checkout-grid');
  const receiptContainer = document.getElementById('receipt-container');
  const btnResetPayment = document.getElementById('btn-reset-payment');

  // Test Fill Presets
  document.getElementById('btn-fill-success')?.addEventListener('click', () => {
    autofillCard('4000 0000 0000 0000', 'Alex Mercer', '12/28', '888');
  });

  document.getElementById('btn-fill-otp')?.addEventListener('click', () => {
    autofillCard('4000 0000 0000 0001', 'Samantha Reed', '09/27', '321');
  });

  document.getElementById('btn-fill-decline')?.addEventListener('click', () => {
    autofillCard('4000 0000 0000 0002', 'Jordan Lee', '05/25', '999');
  });

  function autofillCard(num, name, exp, cvv) {
    cardNumberInput.value = num;
    cardNumberInput.dispatchEvent(new Event('input'));
    cardHolderInput.value = name;
    cardHolderInput.dispatchEvent(new Event('input'));
    cardExpiryInput.value = exp;
    cardExpiryInput.dispatchEvent(new Event('input'));
    cardCvvInput.value = cvv;
    cardCvvInput.dispatchEvent(new Event('input'));
  }

  // Live Input Listeners
  cardHolderInput.addEventListener('input', (e) => {
    const val = e.target.value;
    cardHolderDisplay.textContent = val.trim() ? val.toUpperCase() : 'YOUR NAME HERE';
  });

  cardNumberInput.addEventListener('input', (e) => {
    const formatted = formatCardNumber(e.target.value);
    e.target.value = formatted;

    const brand = detectCardBrand(formatted);
    cardBrandLogo.innerHTML = `<i class="${brand.icon}"></i>`;

    const rawNum = formatted.replace(/\s/g, '');
    let displayMask = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) displayMask += ' ';
      displayMask += rawNum[i] ? rawNum[i] : '•';
    }
    cardNumberDisplay.textContent = displayMask;
  });

  cardExpiryInput.addEventListener('input', (e) => {
    const formatted = formatExpiryDate(e.target.value);
    e.target.value = formatted;
    cardExpiryDisplay.textContent = formatted.length === 5 ? formatted : 'MM/YY';
  });

  cardCvvInput.addEventListener('focus', () => creditCard.classList.add('flipped'));
  cardCvvInput.addEventListener('blur', () => creditCard.classList.remove('flipped'));
  cardCvvInput.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val;
    cardCvvDisplay.textContent = val ? '•'.repeat(val.length) : '•••';
  });

  // Tab Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Form Submission
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    processingModal.classList.add('active');

    const result = await engine.processCardPayment({
      number: cardNumberInput.value,
      holder: cardHolderInput.value,
      expiry: cardExpiryInput.value,
      cvv: cardCvvInput.value,
      amount: '$96.00'
    }, (percent, statusText) => {
      processingStatus.textContent = statusText;
    });

    processingModal.classList.remove('active');

    if (result.state === 'OTP_REQUIRED') {
      otpModal.classList.add('active');
      otpInput.focus();
    } else if (result.success) {
      showReceipt(true, result.transaction);
    } else {
      showReceipt(false, { error: result.error });
    }
  });

  // OTP Verification
  btnSubmitOtp.addEventListener('click', () => {
    const res = engine.verifyOTP(otpInput.value);
    if (res.success) {
      otpModal.classList.remove('active');
      showReceipt(true, res.transaction);
    } else {
      alert(res.error);
    }
  });

  // Show Receipt
  function showReceipt(isSuccess, txnData) {
    checkoutGrid.style.display = 'none';
    receiptContainer.style.display = 'block';

    const icon = document.getElementById('receipt-icon');
    const title = document.getElementById('receipt-title');
    const subtitle = document.getElementById('receipt-subtitle');
    const txId = document.getElementById('receipt-tx-id');

    if (isSuccess) {
      icon.className = 'fa-solid fa-circle-check';
      icon.style.color = 'var(--color-success)';
      title.textContent = 'Payment Successful!';
      subtitle.textContent = 'Approved in sandbox mode. Zero real funds charged.';
      txId.textContent = txnData.id;

      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      icon.className = 'fa-solid fa-circle-xmark';
      icon.style.color = 'var(--color-danger)';
      title.textContent = 'Payment Declined!';
      subtitle.textContent = txnData.error || 'Simulated card decline.';
      txId.textContent = 'REST-TXN-DECLINED-TEST';
    }
  }

  btnResetPayment.addEventListener('click', () => {
    engine.reset();
    receiptContainer.style.display = 'none';
    checkoutGrid.style.display = 'grid';
    paymentForm.reset();
    autofillCard('4000 0000 0000 0000', 'Alex Mercer', '12/28', '888');
  });

  // Default Initial Load
  autofillCard('4000 0000 0000 0000', 'Alex Mercer', '12/28', '888');
});
