import { describe, it, expect } from 'vitest';
import {
  quantizeMoney,
  computeLineNetAmount,
  emptyLineItemFormValue,
  defaultCreateInvoiceValues,
  invoiceToEditFormValues,
  lineItemFormValuesToPayload,
  invoiceFormValuesToCreatePayload,
  editFormValuesToUpdatePayload,
  previewGrandTotal,
} from './invoiceFormUtils';
import type { InvoiceRead } from '../types/billing';

describe('quantizeMoney', () => {
  it('quantizes to 2 decimals and floors negatives at 0', () => {
    expect(quantizeMoney(10.5)).toBe('10.50');
    expect(quantizeMoney(0)).toBe('0.00');
    expect(quantizeMoney(-3)).toBe('0.00');
    expect(quantizeMoney(Number.NaN)).toBe('0.00');
  });
});

describe('computeLineNetAmount — mirrors backend _compute_item_net_amount', () => {
  it('computes net = max(0, unit_price * quantity - discount)', () => {
    expect(computeLineNetAmount('320.00', '1', '32')).toBe('288.00');
    expect(computeLineNetAmount('100', '2', '0')).toBe('200.00');
    // Discount larger than the subtotal floors at 0 (backend rule).
    expect(computeLineNetAmount('10', '1', '50')).toBe('0.00');
  });

  it('handles a numeric quantity argument', () => {
    expect(computeLineNetAmount('100', 3, '0')).toBe('300.00');
  });
});

describe('emptyLineItemFormValue', () => {
  it('returns a blank row with quantity 1', () => {
    expect(emptyLineItemFormValue()).toEqual({
      description: '',
      quantity: '1',
      unit_price: '',
      discount_type: '',
      discount_value: '',
    });
  });
});

describe('defaultCreateInvoiceValues', () => {
  it('prefills today + 30 days due date (backend documented default) and one item', () => {
    const values = defaultCreateInvoiceValues();
    expect(values.patient_id).toBe('');
    expect(values.currency_code).toBe('USD');
    expect(values.items).toHaveLength(1);
    // invoice_date is today's local date; due = invoice + 30 days.
    expect(/^\d{4}-\d{2}-\d{2}$/.test(values.invoice_date)).toBe(true);
    expect(values.due_date > values.invoice_date).toBe(true);
  });
});

describe('invoiceToEditFormValues', () => {
  it('maps an aggregate to the edit form (due_date + notes only)', () => {
    const invoice = {
      due_date: '2026-08-22',
      notes: 'Follow up call',
    } as unknown as InvoiceRead;

    expect(invoiceToEditFormValues(invoice)).toEqual({
      due_date: '2026-08-22',
      notes: 'Follow up call',
    });
  });

  it('coerces null notes to an empty string', () => {
    const invoice = { due_date: '2026-08-22', notes: null } as unknown as InvoiceRead;
    expect(invoiceToEditFormValues(invoice).notes).toBe('');
  });
});

describe('lineItemFormValuesToPayload', () => {
  it('maps a form row to the backend item payload with quantized money', () => {
    const payload = lineItemFormValuesToPayload(
      {
        description: '  Composite restoration — tooth 26  ',
        quantity: '1',
        unit_price: '320.00',
        discount_type: 'PERCENTAGE',
        discount_value: '10',
      },
      1,
    );

    // Backend `_compute_item_net_amount` applies the discount_value as a
    // FLAT amount regardless of discount_type: 320 - 10 = 310 (the backend
    // stays authoritative; the discount_type is display context only).
    expect(payload).toEqual({
      description: 'Composite restoration — tooth 26',
      quantity: 1,
      unit_price: '320.00',
      discount_type: 'PERCENTAGE',
      discount_value: '10.00',
      net_amount: '310.00',
      sequence_number: 1,
    });
  });

  it('maps a row without a discount to null discount fields', () => {
    const payload = lineItemFormValuesToPayload(
      {
        description: 'Cleaning',
        quantity: '2',
        unit_price: '50',
        discount_type: '',
        discount_value: '',
      },
      2,
    );

    expect(payload).toEqual({
      description: 'Cleaning',
      quantity: 2,
      unit_price: '50.00',
      discount_type: null,
      discount_value: null,
      net_amount: '100.00',
      sequence_number: 2,
    });
  });
});

describe('invoiceFormValuesToCreatePayload', () => {
  it('omits empty optional relationships and notes', () => {
    const payload = invoiceFormValuesToCreatePayload({
      patient_id: 'p1',
      treatment_plan_id: '',
      appointment_id: '',
      doctor_id: '',
      currency_code: 'USD',
      invoice_date: '2026-07-23',
      due_date: '2026-08-22',
      notes: '   ',
      items: [emptyLineItemFormValue()],
    });

    expect(payload.patient_id).toBe('p1');
    expect(payload.treatment_plan_id).toBeUndefined();
    expect(payload.appointment_id).toBeUndefined();
    expect(payload.doctor_id).toBeUndefined();
    expect(payload.notes).toBeUndefined();
    expect(payload.items).toHaveLength(1);
  });

  it('includes optional relationships and trims notes when provided', () => {
    const payload = invoiceFormValuesToCreatePayload({
      patient_id: 'p1',
      treatment_plan_id: 'tp-1',
      appointment_id: 'apt-1',
      doctor_id: 'doc-1',
      currency_code: 'USD',
      invoice_date: '2026-07-23',
      due_date: '2026-08-22',
      notes: '  Please call  ',
      items: [emptyLineItemFormValue()],
    });

    expect(payload.treatment_plan_id).toBe('tp-1');
    expect(payload.appointment_id).toBe('apt-1');
    expect(payload.doctor_id).toBe('doc-1');
    expect(payload.notes).toBe('Please call');
  });
});

describe('editFormValuesToUpdatePayload', () => {
  it('maps the edit form to the PATCH payload', () => {
    expect(
      editFormValuesToUpdatePayload({ due_date: '2026-08-30', notes: 'Reminder sent' }),
    ).toEqual({ due_date: '2026-08-30', notes: 'Reminder sent' });
  });

  it('maps a blank notes value to null (backend treats as no notes)', () => {
    expect(editFormValuesToUpdatePayload({ due_date: '2026-08-30', notes: '  ' })).toEqual({
      due_date: '2026-08-30',
      notes: null,
    });
  });
});

describe('previewGrandTotal', () => {
  it('sums the line net amounts', () => {
    const total = previewGrandTotal([
      { description: 'A', quantity: '1', unit_price: '100', discount_type: '', discount_value: '' },
      { description: 'B', quantity: '2', unit_price: '50', discount_type: '', discount_value: '' },
    ]);
    expect(total).toBe('200.00');
  });
});
