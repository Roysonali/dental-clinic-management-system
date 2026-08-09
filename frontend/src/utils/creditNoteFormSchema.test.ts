import { describe, it, expect } from 'vitest';
import {
  creditNoteCreateFormSchema,
  creditNoteVoidFormSchema,
  parseCreditNoteMoney,
} from './creditNoteFormSchema';
import { CREDIT_NOTE_REASON_MAX_LENGTH, CREDIT_NOTE_VOID_REASON_MAX_LENGTH } from '../constants/billing';

function validCreateForm(overrides: Record<string, unknown> = {}) {
  return {
    invoice_id: 'inv-1',
    patient_id: 'pat-1',
    amount: '250.00',
    reason: 'Service charge adjustment',
    expiry_date: '',
    ...overrides,
  };
}

describe('creditNoteCreateFormSchema (backend CreditNoteCreateRequest)', () => {
  it('accepts a minimal valid payload', () => {
    expect(creditNoteCreateFormSchema.safeParse(validCreateForm()).success).toBe(true);
  });

  it('accepts an omitted expiry_date (optional field)', () => {
    expect(
      creditNoteCreateFormSchema.safeParse({
        invoice_id: 'inv-1',
        patient_id: 'pat-1',
        amount: '250.00',
        reason: 'Service charge adjustment',
      }).success,
    ).toBe(true);
  });

  it('requires invoice_id', () => {
    const result = creditNoteCreateFormSchema.safeParse(validCreateForm({ invoice_id: '' }));
    expect(result.success).toBe(false);
  });

  it('requires patient_id', () => {
    const result = creditNoteCreateFormSchema.safeParse(validCreateForm({ patient_id: '' }));
    expect(result.success).toBe(false);
  });

  it('requires a positive amount (backend validate_positive_amount)', () => {
    expect(creditNoteCreateFormSchema.safeParse(validCreateForm({ amount: '0' })).success).toBe(false);
    expect(creditNoteCreateFormSchema.safeParse(validCreateForm({ amount: '-5' })).success).toBe(false);
    expect(creditNoteCreateFormSchema.safeParse(validCreateForm({ amount: 'abc' })).success).toBe(false);
    expect(creditNoteCreateFormSchema.safeParse(validCreateForm({ amount: '10.50' })).success).toBe(true);
  });

  it('requires a non-empty reason', () => {
    const result = creditNoteCreateFormSchema.safeParse(validCreateForm({ reason: '   ' }));
    expect(result.success).toBe(false);
  });

  it(`rejects a reason longer than the backend limit (${CREDIT_NOTE_REASON_MAX_LENGTH})`, () => {
    const result = creditNoteCreateFormSchema.safeParse(
      validCreateForm({ reason: 'x'.repeat(CREDIT_NOTE_REASON_MAX_LENGTH + 1) }),
    );
    expect(result.success).toBe(false);
  });

  it(`accepts a reason at the backend limit (${CREDIT_NOTE_REASON_MAX_LENGTH})`, () => {
    expect(
      creditNoteCreateFormSchema.safeParse(validCreateForm({ reason: 'x'.repeat(CREDIT_NOTE_REASON_MAX_LENGTH) })).success,
    ).toBe(true);
  });

  it('rejects a malformed expiry date and accepts YYYY-MM-DD', () => {
    expect(creditNoteCreateFormSchema.safeParse(validCreateForm({ expiry_date: '23/07/2026' })).success).toBe(false);
    expect(creditNoteCreateFormSchema.safeParse(validCreateForm({ expiry_date: '2026-12-31' })).success).toBe(true);
  });
});

describe('creditNoteVoidFormSchema (backend CreditNoteVoidRequest)', () => {
  it('requires a void reason', () => {
    const result = creditNoteVoidFormSchema.safeParse({ void_reason: '' });
    expect(result.success).toBe(false);
  });

  it(`rejects a reason longer than the frontend cap (${CREDIT_NOTE_VOID_REASON_MAX_LENGTH})`, () => {
    const result = creditNoteVoidFormSchema.safeParse({
      void_reason: 'x'.repeat(CREDIT_NOTE_VOID_REASON_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid void reason', () => {
    expect(creditNoteVoidFormSchema.safeParse({ void_reason: 'Issued in error' }).success).toBe(true);
  });
});

describe('parseCreditNoteMoney', () => {
  it('parses money strings and treats blank input as 0', () => {
    expect(parseCreditNoteMoney('10.50')).toBe(10.5);
    expect(parseCreditNoteMoney('')).toBe(0);
    expect(parseCreditNoteMoney('   ')).toBe(0);
    expect(Number.isNaN(parseCreditNoteMoney('abc'))).toBe(true);
    expect(Number.isNaN(parseCreditNoteMoney(undefined as unknown as string))).toBe(true);
    expect(Number.isNaN(parseCreditNoteMoney(null as unknown as string))).toBe(true);
  });
});
