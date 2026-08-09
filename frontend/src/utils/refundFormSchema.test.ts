import { describe, it, expect } from 'vitest';
import { createRefundFormSchema, parseRefundMoney } from './refundFormSchema';

describe('createRefundFormSchema', () => {
  const schema = createRefundFormSchema(1300); // e.g. ₹1,500 total − ₹200 refunded

  it('accepts a valid refund within the refundable balance', () => {
    const result = schema.safeParse({
      payment_id: 'pay1',
      amount: '250.00',
      reason: 'Duplicate transfer received for the same treatment session.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing payment', () => {
    const result = schema.safeParse({ payment_id: '', amount: '250.00', reason: 'reason' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'payment_id')).toBe(true);
    }
  });

  it('rejects a zero or negative amount', () => {
    expect(schema.safeParse({ payment_id: 'p', amount: '0', reason: 'r' }).success).toBe(false);
    expect(schema.safeParse({ payment_id: 'p', amount: '-10', reason: 'r' }).success).toBe(false);
  });

  it('rejects an amount above the refundable balance', () => {
    const result = schema.safeParse({ payment_id: 'p', amount: '1300.01', reason: 'r' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'amount')).toBe(true);
    }
  });

  it('accepts an amount exactly equal to the refundable balance', () => {
    expect(schema.safeParse({ payment_id: 'p', amount: '1300.00', reason: 'r' }).success).toBe(true);
  });

  it('rejects a missing reason', () => {
    const result = schema.safeParse({ payment_id: 'p', amount: '250.00', reason: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'reason')).toBe(true);
    }
  });

  it('rejects a non-numeric amount', () => {
    expect(schema.safeParse({ payment_id: 'p', amount: 'abc', reason: 'r' }).success).toBe(false);
  });
});

describe('parseRefundMoney', () => {
  it('parses numeric strings and rejects empty input', () => {
    expect(parseRefundMoney('250.00')).toBe(250);
    expect(parseRefundMoney('10')).toBe(10);
    expect(parseRefundMoney('')).toBeNaN();
    expect(parseRefundMoney('  ')).toBeNaN();
    expect(parseRefundMoney('abc')).toBeNaN();
  });
});
