import { describe, it, expect } from 'vitest';
import {
  INVOICE_STATUS_VARIANTS,
  PAYMENT_STATUS_VARIANTS,
  PAYMENT_METHOD_LABELS,
} from './billing';

describe('INVOICE_STATUS_VARIANTS', () => {
  it('maps every backend InvoiceStatus value to a badge variant', () => {
    // Mirrors backend app/modules/billing/enums.py — InvoiceStatus.
    const statuses = [
      'draft',
      'issued',
      'partially_paid',
      'paid',
      'overdue',
      'cancelled',
      'void',
    ] as const;

    for (const status of statuses) {
      expect(INVOICE_STATUS_VARIANTS[status]).toBeDefined();
    }
  });
});

describe('PAYMENT_STATUS_VARIANTS', () => {
  it('maps every backend PaymentStatus value to a badge variant', () => {
    // Mirrors backend app/modules/billing/enums.py — PaymentStatus.
    const statuses = [
      'pending',
      'completed',
      'failed',
      'refunded',
      'reversed',
      'void',
    ] as const;

    for (const status of statuses) {
      expect(PAYMENT_STATUS_VARIANTS[status]).toBeDefined();
    }
  });
});

describe('PAYMENT_METHOD_LABELS', () => {
  it('labels every backend PaymentMethod value', () => {
    // Mirrors backend app/modules/billing/enums.py — PaymentMethod.
    const methods = [
      'cash',
      'card',
      'upi',
      'bank_transfer',
      'cheque',
      'insurance',
      'wallet',
    ] as const;

    for (const method of methods) {
      expect(PAYMENT_METHOD_LABELS[method]).toBeDefined();
      expect(PAYMENT_METHOD_LABELS[method].length).toBeGreaterThan(0);
    }
  });
});
