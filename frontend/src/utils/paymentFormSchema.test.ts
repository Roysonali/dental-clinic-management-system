import { describe, it, expect } from 'vitest';
import { paymentFormSchema, type PaymentFormValues } from './paymentFormSchema';

const valid: PaymentFormValues = {
  patient_id: 'p1',
  payment_method: 'card',
  total_amount: '1500.00',
  payment_date: '2026-07-23',
  reference_number: 'TXN-123',
  notes: 'Paid via gateway',
};

function validate(overrides: Partial<PaymentFormValues>) {
  const result = paymentFormSchema.safeParse({ ...valid, ...overrides });
  return result.success ? null : result.error.flatten().fieldErrors;
}

describe('paymentFormSchema', () => {
  it('accepts a complete valid payment', () => {
    expect(paymentFormSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a patient', () => {
    expect(validate({ patient_id: '' })).toHaveProperty('patient_id');
  });

  it('requires a payment method', () => {
    expect(validate({ payment_method: '' })).toHaveProperty('payment_method');
  });

  it('rejects a zero, negative or non-numeric amount', () => {
    expect(validate({ total_amount: '0' })).toHaveProperty('total_amount');
    expect(validate({ total_amount: '-5' })).toHaveProperty('total_amount');
    expect(validate({ total_amount: 'abc' })).toHaveProperty('total_amount');
  });

  it('rejects an amount above the backend MAX_MONEY_AMOUNT', () => {
    expect(validate({ total_amount: '1000000000000' })).toHaveProperty('total_amount');
  });

  it('accepts a positive decimal amount', () => {
    expect(validate({ total_amount: '10.50' })).toBeNull();
  });

  it('requires a payment date in YYYY-MM-DD', () => {
    expect(validate({ payment_date: '' })).toHaveProperty('payment_date');
    expect(validate({ payment_date: '23/07/2026' })).toHaveProperty('payment_date');
  });

  it('bounds the reference number to 100 characters (backend TRANSACTION_REFERENCE_MAX_LENGTH)', () => {
    expect(validate({ reference_number: 'x'.repeat(101) })).toHaveProperty('reference_number');
    expect(validate({ reference_number: 'x'.repeat(100) })).toBeNull();
  });

  it('bounds notes to 500 characters (backend PAYMENT_NOTES_MAX_LENGTH)', () => {
    expect(validate({ notes: 'x'.repeat(501) })).toHaveProperty('notes');
    expect(validate({ notes: 'x'.repeat(500) })).toBeNull();
  });
});
