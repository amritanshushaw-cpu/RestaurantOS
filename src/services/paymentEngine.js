/**
 * RestaurantOS - Payment Engine State Machine & Sandbox Service
 * Handles payment scenarios (Success, 3DS OTP, Decline) and transaction lifecycle.
 */

import { validateLuhn, validateExpiry } from '../utils/validation.js';

export const PaymentStates = {
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  OTP_REQUIRED: 'OTP_REQUIRED',
  SUCCESS: 'SUCCESS',
  DECLINED: 'DECLINED'
};

export class PaymentEngine {
  constructor() {
    this.currentState = PaymentStates.IDLE;
    this.activeTransaction = null;
  }

  // Generate random transaction ID
  generateTransactionId() {
    const randomPart = Math.floor(10000000 + Math.random() * 90000000);
    return `REST-TXN-${randomPart}-TEST`;
  }

  // Determine scenario based on card ending
  determineScenario(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.endsWith('0001')) return 'OTP';
    if (cleaned.endsWith('0002')) return 'DECLINE';
    return 'SUCCESS';
  }

  // Process Card Payment
  async processCardPayment(cardDetails, onProgress) {
    this.currentState = PaymentStates.PROCESSING;
    
    // Step 1: Encrypting
    if (onProgress) onProgress(25, 'Encrypting payment payload...');
    await new Promise(r => setTimeout(r, 600));

    // Step 2: Validate Card Data
    if (!validateLuhn(cardDetails.number)) {
      this.currentState = PaymentStates.DECLINED;
      return {
        success: false,
        state: PaymentStates.DECLINED,
        error: 'Invalid card number checksum (Luhn check failed)'
      };
    }

    if (!validateExpiry(cardDetails.expiry)) {
      this.currentState = PaymentStates.DECLINED;
      return {
        success: false,
        state: PaymentStates.DECLINED,
        error: 'Invalid card expiration date'
      };
    }

    // Step 3: Connecting to Bank
    if (onProgress) onProgress(65, 'Connecting to card issuer enclave...');
    await new Promise(r => setTimeout(r, 700));

    // Step 4: Determine Scenario
    const scenario = this.determineScenario(cardDetails.number);

    if (onProgress) onProgress(100, 'Finalizing security parameters...');
    await new Promise(r => setTimeout(r, 400));

    if (scenario === 'OTP') {
      this.currentState = PaymentStates.OTP_REQUIRED;
      this.activeTransaction = {
        id: this.generateTransactionId(),
        amount: cardDetails.amount || '₹1584.00',
        method: `Card ending in ${cardDetails.number.slice(-4)}`,
        scenario: 'OTP',
        passcode: '123456'
      };
      return {
        success: false,
        state: PaymentStates.OTP_REQUIRED,
        transaction: this.activeTransaction
      };
    }

    if (scenario === 'DECLINE') {
      this.currentState = PaymentStates.DECLINED;
      return {
        success: false,
        state: PaymentStates.DECLINED,
        error: 'Transaction Declined: Insufficient Sandbox Funds'
      };
    }

    // Success
    this.currentState = PaymentStates.SUCCESS;
    this.activeTransaction = {
      id: this.generateTransactionId(),
      amount: cardDetails.amount || '₹1584.00',
      method: `Card ending in ${cardDetails.number.slice(-4)}`,
      timestamp: new Date().toISOString(),
      status: 'APPROVED'
    };


    return {
      success: true,
      state: PaymentStates.SUCCESS,
      transaction: this.activeTransaction
    };
  }

  // Verify 3DS OTP Passcode
  verifyOTP(passcode) {
    if (passcode === '123456') {
      this.currentState = PaymentStates.SUCCESS;
      if (this.activeTransaction) {
        this.activeTransaction.status = 'APPROVED';
        this.activeTransaction.timestamp = new Date().toISOString();
      }
      return {
        success: true,
        state: PaymentStates.SUCCESS,
        transaction: this.activeTransaction
      };
    }

    return {
      success: false,
      state: PaymentStates.OTP_REQUIRED,
      error: 'Invalid 3DS Passcode. Enter 123456 for Sandbox.'
    };
  }

  reset() {
    this.currentState = PaymentStates.IDLE;
    this.activeTransaction = null;
  }
}
