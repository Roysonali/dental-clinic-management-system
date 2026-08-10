import { describe, it, expect } from 'vitest';
import {
  defaultPaymentFormValues,
  paymentFormValuesToCreatePayload,
  paymentToEditFormValues,
} from './paymentFormUtils';
import type { PaymentRead } from '../types/billing';

describe('defaultPaymentFormValues', () => {
  it('defaults the payment date to today and clears all fields', () => {
    const values = defaultPaymentFormValues();
    expect(values.patient_id).toBe('');
    expect(values.payment_method).toBe('');
    expect(values.total_amount).toBe('');
    expect(values.reference_number).toBe('');
    expect(values.notes).toBe('');
    expect(values.payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('paymentFormValuesToCreatePayload', () => {
  it('maps fields and quantizes the amount to 2dp (backend NUMERIC(12,2))', () => {
    const payload = paymentFormValuesToCreatePayload({
      patient_id: 'p1',
      payment_method: 'card',
      total_amount: '1500.5',
      payment_date: '2026-07-23',
      reference_number: ' TXN-123 ',
      notes: '  Paid via gateway  ',
    });

    expect(payload).toEqual({
      patient_id: 'p1',
      payment_method: 'card',
      total_amount: '1500.50',
      payment_date: '2026-07-23',
      reference_number: 'TXN-123',
      notes: 'Paid via gateway',
    });
  });

  it('omits optional reference and notes when blank', () => {
    const payload = paymentFormValuesToCreatePayload({
      patient_id: 'p1',
      payment_method: 'cash',
      total_amount: '50',
      payment_date: '2026-07-23',
      reference_number: '   ',
      notes: '',
    });

    expect(payload.reference_number).toBeUndefined();
    expect(payload.notes).toBeUndefined();
  });
});

describe('paymentToEditFormValues', () => {
  it('prefills reference and notes from the aggregate', () => {
    const payment = {
      reference_number: 'REF-1',
      notes: 'hello',
    } as PaymentRead;

    expect(paymentToEditFormValues(payment)).toEqual({
      reference_number: 'REF-1',
      notes: 'hello',
    });
  });
});
