import { describe, it, expect } from 'vitest';
import { parseSnapshotMoney, formatTreatmentCost } from './treatmentPlanFormatting';

describe('treatmentPlanFormatting (Decimal wire-format contract — F-03)', () => {
  describe('parseSnapshotMoney', () => {
    it('parses string Decimals as persisted in version snapshots (str(Decimal))', () => {
      expect(parseSnapshotMoney('15000.00')).toBe(15000);
      expect(parseSnapshotMoney('0.00')).toBe(0);
      expect(parseSnapshotMoney('999999.99')).toBe(999999.99);
    });

    it('accepts JSON numbers (top-level response wire format)', () => {
      expect(parseSnapshotMoney(15000.0)).toBe(15000);
      expect(parseSnapshotMoney(0)).toBe(0);
    });

    it('is NaN-safe on empty / null / undefined / garbage', () => {
      expect(parseSnapshotMoney(null)).toBe(0);
      expect(parseSnapshotMoney(undefined)).toBe(0);
      expect(parseSnapshotMoney('')).toBe(0);
      expect(parseSnapshotMoney('not-a-number')).toBe(0);
    });
  });

  describe('formatTreatmentCost', () => {
    it('formats numbers with the module currency symbol (2 decimals)', () => {
      expect(formatTreatmentCost(1500)).toBe('₱1500.00');
      expect(formatTreatmentCost(0)).toBe('₱0.00');
    });

    it('formats string Decimals too (snapshot money)', () => {
      expect(formatTreatmentCost('15000.00')).toBe('₱15000.00');
    });

    it('renders a dash for undefined (pre-fix F-01 placeholder behaviour)', () => {
      expect(formatTreatmentCost(undefined)).toBe('—');
    });
  });
});
