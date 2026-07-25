/**
 * RestaurantOS - Card Validation & Input Formatting Utilities
 * Standalone pure functions for Luhn algorithm check, brand detection, and field formatters.
 */

// Luhn Algorithm Checksum Validation
export function validateLuhn(cardNumber) {
  const digits = (cardNumber || '').replace(/\D/g, '');
  if (!digits || digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return (sum % 10) === 0;
}

// Detect Card Brand (Visa, Mastercard, Amex, Discover)
export function detectCardBrand(cardNumber) {
  const cleaned = (cardNumber || '').replace(/\D/g, '');
  if (/^4/.test(cleaned)) return { brand: 'visa', icon: 'fa-brands fa-cc-visa' };
  if (/^(5[1-5]|2[2-7])/.test(cleaned)) return { brand: 'mastercard', icon: 'fa-brands fa-cc-mastercard' };
  if (/^3[47]/.test(cleaned)) return { brand: 'amex', icon: 'fa-brands fa-cc-amex' };
  if (/^6(?:011|5)/.test(cleaned)) return { brand: 'discover', icon: 'fa-brands fa-cc-discover' };
  return { brand: 'unknown', icon: 'fa-solid fa-credit-card' };
}

// Format Card Number (adds space every 4 digits up to 16 digits)
export function formatCardNumber(value) {
  const cleaned = (value || '').replace(/\D/g, '').slice(0, 16);
  const parts = [];

  for (let i = 0; i < cleaned.length; i += 4) {
    parts.push(cleaned.substring(i, i + 4));
  }

  return parts.join(' ');
}

// Format Expiration Date (MM/YY)
export function formatExpiryDate(value) {
  const cleaned = (value || '').replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 3) {
    return cleaned.substring(0, 2) + '/' + cleaned.substring(2);
  }
  if (cleaned.length === 2 && (value || '').includes('/')) {
    return cleaned.substring(0, 2) + '/';
  }
  return cleaned;
}

// Validate Expiration Date (Future date check)
export function validateExpiry(expiryStr) {
  if (!expiryStr || !/^\d{2}\/\d{2}$/.test(expiryStr)) return false;

  const [monthStr, yearStr] = expiryStr.split('/');
  const month = parseInt(monthStr, 10);
  const year = parseInt('20' + yearStr, 10);

  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  return true;
}
