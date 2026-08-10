import { describe, it, expect } from 'vitest';
import {
  formatCreditNoteNumber,
  formatCreditNoteAmount,
  formatCreditNoteDate,
  formatCreditNoteDateTime,
} from './creditNoteFormatting';

describe('creditNoteFormatting', () => {
  describe('formatCreditNoteNumber', () => {
    it('passes through the assigned number', () => {
      expect(formatCreditNoteNumber('CN-00042')).toBe('CN-00042');
    });

    it('returns an em dash for missing numbers', () => {
      expect(formatCreditNoteNumber(null)).toBe('—');
      expect(formatCreditNoteNumber(undefined)).toBe('—');
      expect(formatCreditNoteNumber('')).toBe('—');
    });
  });

  describe('formatCreditNoteAmount', () => {
    it('formats with the currency symbol', () => {
      expect(formatCreditNoteAmount('100.00', 'INR')).toBe('₹100.00');
      expect(formatCreditNoteAmount('4210.5', 'USD')).toBe('$4,210.50');
    });

    it('falls back to code-prefixed display for unknown currencies', () => {
      expect(formatCreditNoteAmount('50', 'XYZ')).toBe('XYZ 50.00');
    });

    it('returns an em dash for missing/invalid amounts', () => {
      expect(formatCreditNoteAmount(null)).toBe('—');
      expect(formatCreditNoteAmount(undefined)).toBe('—');
      expect(formatCreditNoteAmount('')).toBe('—');
      expect(formatCreditNoteAmount('not-a-number')).toBe('—');
    });
  });

  describe('formatCreditNoteDate', () => {
    it('formats a YYYY-MM-DD date', () => {
      expect(formatCreditNoteDate('2026-07-23')).toBe('Jul 23, 2026');
    });

    it('returns an em dash for missing dates', () => {
      expect(formatCreditNoteDate(null)).toBe('—');
      expect(formatCreditNoteDate(undefined)).toBe('—');
    });

    it('passes through unparseable values', () => {
      expect(formatCreditNoteDate('not-a-date')).toBe('not-a-date');
    });
  });

  describe('formatCreditNoteDateTime', () => {
    it('formats an ISO datetime', () => {
      const out = formatCreditNoteDateTime('2026-07-23T10:30:00');
      expect(out).not.toBe('—');
      expect(out).toContain('2026');
    });

    it('returns an em dash for missing datetimes', () => {
      expect(formatCreditNoteDateTime(null)).toBe('—');
      expect(formatCreditNoteDateTime(undefined)).toBe('—');
    });
  });
});
