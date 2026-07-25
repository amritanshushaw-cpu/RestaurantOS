/**
 * RestaurantOS - Main Application Controller
 * Connects DOM UI elements with validation utilities and PaymentEngine service.
 */

import { detectCardBrand, formatCardNumber, formatExpiryDate } from './utils/validation.js';
import { PaymentEngine } from './services/paymentEngine.js';
import { dbEngine } from './services/supabaseClient.js';

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

  // --- Live Order / Billing Wiring (payment.html only) ---
  const orderSelect = document.getElementById('order-select');
  const orderSummaryTitle = document.getElementById('order-summary-title');
  const orderLineItems = document.getElementById('order-line-items');
  const orderTotalDisplay = document.getElementById('order-total-display');
  const payBtnAmount = document.getElementById('pay-btn-amount');
  const payNowBtn = document.getElementById('pay-now-btn');
  const receiptAmountEl = document.getElementById('receipt-amount');

  let activeOrder = null;

  function refreshOrderSelector() {
    if (!orderSelect) return; // Not on the payment page

    const unpaidOrders = typeof dbEngine.getUnpaidOrders === 'function' ? dbEngine.getUnpaidOrders() : dbEngine.getOrders().filter(o => o.status !== 'PAID');
    orderSelect.innerHTML = '';

    if (unpaidOrders.length === 0) {
      orderSelect.innerHTML = `<option value="">No open orders — send one from POS Terminal first</option>`;
      activeOrder = null;
      renderOrderSummary(null);
      if (payNowBtn) payNowBtn.disabled = true;
      return;
    }

    unpaidOrders.forEach(order => {
      const opt = document.createElement('option');
      opt.value = order.id;
      opt.textContent = `${order.table_number || 'Takeaway'} — ${order.order_number} ($${parseFloat(order.total).toFixed(2)})`;
      orderSelect.appendChild(opt);
    });

    activeOrder = unpaidOrders[0];
    orderSelect.value = activeOrder.id;
    renderOrderSummary(activeOrder);
    if (payNowBtn) payNowBtn.disabled = false;
  }

  function renderOrderSummary(order) {
    if (!orderLineItems) return;

    if (!order) {
      if (orderSummaryTitle) orderSummaryTitle.textContent = 'No Open Orders';
      orderLineItems.innerHTML = `<p style="font-size: 13px; color: var(--text-tertiary);">Place an order from the POS Terminal, then come back here to collect payment.</p>`;
      if (orderTotalDisplay) orderTotalDisplay.textContent = '$0.00';
      if (payBtnAmount) payBtnAmount.textContent = '$0.00';
      return;
    }

    if (orderSummaryTitle) orderSummaryTitle.textContent = `${order.table_number || 'Takeaway'} Order Summary`;
    orderLineItems.innerHTML = (order.items || []).map(item => `
      <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 10px;">
        <span>${item.quantity}x ${item.name || item.item_name}</span>
        <strong style="font-family: var(--font-mono);">$${(item.price * item.quantity).toFixed(2)}</strong>
      </div>
    `).join('');

    const total = parseFloat(order.total || 0).toFixed(2);
    if (orderTotalDisplay) orderTotalDisplay.textContent = `$${total}`;
    if (payBtnAmount) payBtnAmount.textContent = `$${total}`;
  }

  if (orderSelect) {
    orderSelect.addEventListener('change', () => {
      const allOrders = dbEngine.getOrders();
      activeOrder = allOrders.find(o => o.id === orderSelect.value);
      renderOrderSummary(activeOrder);
    });
  }

  refreshOrderSelector();

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
    if (!cardNumberInput) return;
    cardNumberInput.value = num;
    cardNumberInput.dispatchEvent(new Event('input'));
    if (cardHolderInput) {
      cardHolderInput.value = name;
      cardHolderInput.dispatchEvent(new Event('input'));
    }
    if (cardExpiryInput) {
      cardExpiryInput.value = exp;
      cardExpiryInput.dispatchEvent(new Event('input'));
    }
    if (cardCvvInput) {
      cardCvvInput.value = cvv;
      cardCvvInput.dispatchEvent(new Event('input'));
    }
  }

  // Live Input Listeners
  if (cardHolderInput) {
    cardHolderInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (cardHolderDisplay) {
        cardHolderDisplay.textContent = val.trim() ? val.toUpperCase() : 'YOUR NAME HERE';
      }
    });
  }

  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      const formatted = formatCardNumber(e.target.value);
      e.target.value = formatted;

      const brand = detectCardBrand(formatted);
      if (cardBrandLogo) {
        cardBrandLogo.innerHTML = `<i class="${brand.icon}"></i>`;
      }

      const rawNum = formatted.replace(/\s/g, '');
      let displayMask = '';
      for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) displayMask += ' ';
        displayMask += rawNum[i] ? rawNum[i] : '•';
      }
      if (cardNumberDisplay) {
        cardNumberDisplay.textContent = displayMask;
      }
    });
  }

  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
      const formatted = formatExpiryDate(e.target.value);
      e.target.value = formatted;
      if (cardExpiryDisplay) {
        cardExpiryDisplay.textContent = formatted.length === 5 ? formatted : 'MM/YY';
      }
    });
  }

  if (cardCvvInput) {
    cardCvvInput.addEventListener('focus', () => creditCard?.classList.add('flipped'));
    cardCvvInput.addEventListener('blur', () => creditCard?.classList.remove('flipped'));
    cardCvvInput.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (cardCvvDisplay) {
        cardCvvDisplay.textContent = val ? '•'.repeat(val.length) : '•••';
      }
    });
  }

  // Tab Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Form Submission
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (orderSelect && !activeOrder) {
        alert('No open order selected. Send an order from the POS Terminal first.');
        return;
      }

      if (processingModal) processingModal.classList.add('active');

      const amountLabel = activeOrder ? `$${parseFloat(activeOrder.total).toFixed(2)}` : '$96.00';

      const result = await engine.processCardPayment({
        number: cardNumberInput ? cardNumberInput.value : '',
        holder: cardHolderInput ? cardHolderInput.value : '',
        expiry: cardExpiryInput ? cardExpiryInput.value : '',
        cvv: cardCvvInput ? cardCvvInput.value : '',
        amount: amountLabel
      }, (percent, statusText) => {
        if (processingStatus) processingStatus.textContent = statusText;
      });

      if (processingModal) processingModal.classList.remove('active');

      if (result.state === 'OTP_REQUIRED') {
        if (otpModal) otpModal.classList.add('active');
        if (otpInput) otpInput.focus();
      } else if (result.success) {
        finalizeOrderPayment();
        showReceipt(true, result.transaction);
      } else {
        if (typeof dbEngine.logPaymentAttempt === 'function') dbEngine.logPaymentAttempt(false);
        showReceipt(false, { error: result.error });
      }
    });
  }

  // OTP Verification
  if (btnSubmitOtp) {
    btnSubmitOtp.addEventListener('click', () => {
      const res = engine.verifyOTP(otpInput ? otpInput.value : '');
      if (res.success) {
        if (otpModal) otpModal.classList.remove('active');
        finalizeOrderPayment();
        showReceipt(true, res.transaction);
      } else {
        alert(res.error);
      }
    });
  }

  // Mark the real order as PAID and free the table once payment clears
  function finalizeOrderPayment() {
    if (typeof dbEngine.logPaymentAttempt === 'function') dbEngine.logPaymentAttempt(true);
    if (activeOrder) {
      dbEngine.updateOrderStatus(activeOrder.id, 'PAID');
    }
  }

  // Show Receipt
  function showReceipt(isSuccess, txnData) {
    if (checkoutGrid) checkoutGrid.style.display = 'none';
    if (receiptContainer) receiptContainer.style.display = 'block';

    const icon = document.getElementById('receipt-icon');
    const title = document.getElementById('receipt-title');
    const subtitle = document.getElementById('receipt-subtitle');
    const txId = document.getElementById('receipt-tx-id');
    const paidAmount = activeOrder ? `$${parseFloat(activeOrder.total).toFixed(2)}` : '$96.00';
    if (receiptAmountEl) receiptAmountEl.textContent = `${paidAmount} USD`;

    if (isSuccess) {
      if (icon) {
        icon.className = 'fa-solid fa-circle-check';
        icon.style.color = 'var(--color-accent-lime)';
      }
      if (title) title.textContent = 'Payment Successful!';
      if (subtitle) subtitle.textContent = 'Approved in sandbox mode. Zero real funds charged.';
      if (txId) txId.textContent = txnData ? txnData.id : 'REST-TXN-SUCCESS';

      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      if (icon) {
        icon.className = 'fa-solid fa-circle-xmark';
        icon.style.color = 'var(--color-danger)';
      }
      if (title) title.textContent = 'Payment Declined!';
      if (subtitle) subtitle.textContent = (txnData && txnData.error) ? txnData.error : 'Simulated card decline.';
      if (txId) txId.textContent = 'REST-TXN-DECLINED-TEST';
    }
  }

  if (btnResetPayment) {
    btnResetPayment.addEventListener('click', () => {
      engine.reset();
      if (receiptContainer) receiptContainer.style.display = 'none';
      if (checkoutGrid) checkoutGrid.style.display = 'grid';
      if (paymentForm) paymentForm.reset();
      refreshOrderSelector();
      autofillCard('4000 0000 0000 0000', 'Alex Mercer', '12/28', '888');
    });
  }

  // Default Initial Load
  if (cardNumberInput) {
    autofillCard('4000 0000 0000 0000', 'Alex Mercer', '12/28', '888');
  }
});
