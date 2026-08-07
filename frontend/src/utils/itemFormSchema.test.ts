import { describe, it, expect } from 'vitest';
import { itemFormSchema } from './itemFormSchema';

const base = {
  procedure_id: '5',
  sequence_number: '1',
  tooth_number: '',
  tooth_surface: '',
  quadrant: '',
  arch: '',
  estimated_cost: '',
  discount: '',
  notes: '',
};

describe('itemFormSchema', () => {
  it('accepts a valid item', () => {
    const result = itemFormSchema.safeParse({
      ...base,
      procedure_id: '5',
      sequence_number: '2',
      tooth_number: '46',
      tooth_surface: 'MOD',
      quadrant: 'UR',
      arch: 'upper',
      estimated_cost: '1500',
      discount: '100',
    });
    expect(result.success).toBe(true);
  });

  it('requires procedure and sequence', () => {
    const result = itemFormSchema.safeParse({ ...base, procedure_id: '', sequence_number: '' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive sequence numbers', () => {
    const result = itemFormSchema.safeParse({ ...base, sequence_number: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range FDI tooth numbers (49 is invalid)', () => {
    const result = itemFormSchema.safeParse({ ...base, tooth_number: '49' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'tooth_number')).toBe(true);
    }
  });

  it('accepts FDI permanent range boundaries (11–48)', () => {
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '11' }).success).toBe(true);
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '48' }).success).toBe(true);
  });

  it('rejects the FDI gap between permanent and primary (49–50)', () => {
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '49' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '50' }).success).toBe(false);
  });

  it('accepts FDI primary range boundaries (51–85)', () => {
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '51' }).success).toBe(true);
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '55' }).success).toBe(true);
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '85' }).success).toBe(true);
  });

  it('rejects out-of-range tooth numbers (0, 10, 86, 100)', () => {
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '0' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '10' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '86' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '100' }).success).toBe(false);
  });

  it('rejects non-numeric tooth numbers', () => {
    expect(itemFormSchema.safeParse({ ...base, tooth_number: '4x' }).success).toBe(false);
  });

  it('rejects cost beyond 999999.99', () => {
    const result = itemFormSchema.safeParse({ ...base, estimated_cost: '1000000' });
    expect(result.success).toBe(false);
  });

  it('rejects negative and non-numeric costs', () => {
    expect(itemFormSchema.safeParse({ ...base, estimated_cost: '-5' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...base, estimated_cost: 'abc' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...base, discount: '-1' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...base, discount: 'abc' }).success).toBe(false);
  });

  it('rejects discount greater than the estimated cost', () => {
    const result = itemFormSchema.safeParse({ ...base, estimated_cost: '100', discount: '150' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'discount')).toBe(true);
    }
  });

  it('accepts a long tooth-surface string (soft validation only — O8)', () => {
    const result = itemFormSchema.safeParse({ ...base, tooth_surface: 'XYZ' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid quadrant / arch values', () => {
    expect(itemFormSchema.safeParse({ ...base, quadrant: 'XX' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...base, arch: 'sideways' }).success).toBe(false);
  });
});
