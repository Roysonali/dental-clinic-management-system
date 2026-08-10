import { describe, it, expect } from 'vitest';
import { getPaymentActions, isPendingPayment } from './paymentStateMachine';

/**
 * Mirrors backend `PAYMENT_TRANSITIONS` + the router's exposed endpoints.
 * The router exposes complete/fail/void/allocate/delete but NO retry
 * (FAILED→PENDING), refund or reversal endpoint, so those never appear.
 */
describe('getPaymentActions', () => {
  it('exposes complete/fail/void/delete for Pending payments', () => {
    expect(getPaymentActions('pending')).toEqual(['complete', 'fail', 'void', 'delete']);
  });

  it('exposes allocate for Completed payments', () => {
    expect(getPaymentActions('completed')).toEqual(['allocate']);
  });

  it('exposes no actions for terminal/other statuses (no router-exposed transitions)', () => {
    expect(getPaymentActions('failed')).toEqual([]);
    expect(getPaymentActions('refunded')).toEqual([]);
    expect(getPaymentActions('reversed')).toEqual([]);
    expect(getPaymentActions('void')).toEqual([]);
  });
});

describe('isPendingPayment', () => {
  it('is true only for Pending', () => {
    expect(isPendingPayment('pending')).toBe(true);
    expect(isPendingPayment('completed')).toBe(false);
    expect(isPendingPayment('void')).toBe(false);
  });
});
