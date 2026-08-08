import { describe, it, expect } from 'vitest';
import {
  invoiceCreateFormSchema,
  invoiceEditFormSchema,
  invoiceCancelFormSchema,
  parseMoney,
} from './invoiceFormSchema';

const validItems = [
  {
    description: 'Composite restoration — tooth 26',
    quantity: '1',
    unit_price: '320.00',
    discount_type: 'PERCENTAGE',
    discount_value: '10',
  },
];

function validForm(overrides: Record<string, unknown> = {}) {
  return {
    patient_id: 'p1',
    treatment_plan_id: '',
    appointment_id: '',
    doctor_id: '',
    currency_code: 'INR',
    invoice_date: '2026-07-23',
    due_date: '2026-08-22',
    notes: '',
    items: validItems,
    ...overrides,
  };
}

describe('invoiceCreateFormSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(invoiceCreateFormSchema.safeParse(validForm()).success).toBe(true);
  });

  it('requires a patient (backend create schema requires patient_id)', () => {
    const result = invoiceCreateFormSchema.safeParse(validForm({ patient_id: '' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'patient_id')).toBe(true);
    }
  });

  it('requires both dates in YYYY-MM-DD format', () => {
    const badDate = invoiceCreateFormSchema.safeParse(validForm({ invoice_date: '23/07/2026' }));
    expect(badDate.success).toBe(false);

    const missing = invoiceCreateFormSchema.safeParse(validForm({ due_date: '' }));
    expect(missing.success).toBe(false);
  });

  it('rejects due_date before invoice_date (backend validate_due_date)', () => {
    const result = invoiceCreateFormSchema.safeParse(
      validForm({ invoice_date: '2026-08-22', due_date: '2026-07-23' }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'due_date')).toBe(true);
    }
  });

  it('accepts due_date equal to invoice_date (due >= invoice)', () => {
    expect(
      invoiceCreateFormSchema.safeParse(
        validForm({ invoice_date: '2026-07-23', due_date: '2026-07-23' }),
      ).success,
    ).toBe(true);
  });

  it('rejects notes longer than the backend max (2000, not 500)', () => {
    const result = invoiceCreateFormSchema.safeParse(validForm({ notes: 'x'.repeat(2001) }));
    expect(result.success).toBe(false);
  });

  it('requires at least one line item (backend MIN_LINE_ITEMS_PER_INVOICE)', () => {
    const result = invoiceCreateFormSchema.safeParse(validForm({ items: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'items')).toBe(true);
    }
  });

  it('rejects an empty item description', () => {
    const result = invoiceCreateFormSchema.safeParse(
      validForm({ items: [{ ...validItems[0], description: '' }] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a non-whole or below-minimum quantity', () => {
    const badQty = invoiceCreateFormSchema.safeParse(
      validForm({ items: [{ ...validItems[0], quantity: '1.5' }] }),
    );
    expect(badQty.success).toBe(false);

    const zeroQty = invoiceCreateFormSchema.safeParse(
      validForm({ items: [{ ...validItems[0], quantity: '0' }] }),
    );
    expect(zeroQty.success).toBe(false);
  });

  it('rejects a negative unit price', () => {
    const result = invoiceCreateFormSchema.safeParse(
      validForm({ items: [{ ...validItems[0], unit_price: '-5' }] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a discount that exceeds the line subtotal (backend validation)', () => {
    // unit_price 320 × qty 1 = 320; a fixed discount of 400 exceeds it.
    const result = invoiceCreateFormSchema.safeParse(
      validForm({
        items: [
          {
            description: 'Item',
            quantity: '1',
            unit_price: '320.00',
            discount_type: 'FIXED_AMOUNT',
            discount_value: '400',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => String(i.path[0]) === 'items' && String(i.path[2]) === 'discount_value'),
      ).toBe(true);
    }
  });

  it('accepts a discount within the line subtotal', () => {
    expect(
      invoiceCreateFormSchema.safeParse(
        validForm({
          items: [
            {
              description: 'Item',
              quantity: '1',
              unit_price: '320.00',
              discount_type: 'FIXED_AMOUNT',
              discount_value: '32',
            },
          ],
        }),
      ).success,
    ).toBe(true);
  });
});

describe('invoiceEditFormSchema (PATCH only exposes notes + due_date)', () => {
  it('accepts a valid edit payload', () => {
    expect(
      invoiceEditFormSchema.safeParse({ due_date: '2026-08-30', notes: 'Reminder sent' }).success,
    ).toBe(true);
  });

  it('is a form-string schema — null notes are normalized to "" by the form utils', () => {
    // The form only ever holds strings (invoiceToEditFormValues maps null → '');
    // the empty-string → null conversion happens in editFormValuesToUpdatePayload
    // when building the PATCH body. The schema itself accepts empty strings.
    expect(invoiceEditFormSchema.safeParse({ due_date: '2026-08-30', notes: '' }).success).toBe(
      true,
    );
  });

  it('rejects a malformed due date', () => {
    const result = invoiceEditFormSchema.safeParse({ due_date: 'tomorrow', notes: '' });
    expect(result.success).toBe(false);
  });

  it('rejects notes over the backend max length', () => {
    const result = invoiceEditFormSchema.safeParse({
      due_date: '2026-08-30',
      notes: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('invoiceCancelFormSchema (backend requires 1–500 char reason)', () => {
  it('requires a cancellation reason', () => {
    const result = invoiceCancelFormSchema.safeParse({ cancellation_reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a reason longer than 500 chars', () => {
    const result = invoiceCancelFormSchema.safeParse({ cancellation_reason: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts a valid reason', () => {
    expect(invoiceCancelFormSchema.safeParse({ cancellation_reason: 'Duplicate invoice' }).success).toBe(true);
  });
});

describe('parseMoney', () => {
  it('parses money strings and treats empty input as 0', () => {
    expect(parseMoney('10.50')).toBe(10.5);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('  ')).toBe(0);
    expect(Number.isNaN(parseMoney('abc'))).toBe(true);
  });
});
