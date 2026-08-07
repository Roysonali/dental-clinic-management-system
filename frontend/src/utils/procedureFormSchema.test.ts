import { describe, it, expect } from 'vitest';
import { procedureFormSchema, defaultProcedureFormValues } from './procedureFormSchema';
import { PROCEDURE_CATEGORIES } from '../constants/procedure';

const base = {
  code: 'RCT',
  name: 'Root Canal',
  description: '',
  default_cost: '15000',
  category: 'endodontic',
};

describe('procedureFormSchema', () => {
  it('accepts a valid procedure', () => {
    const result = procedureFormSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('provides empty default values', () => {
    expect(defaultProcedureFormValues).toEqual({
      code: '',
      name: '',
      description: '',
      default_cost: '',
      category: '',
    });
  });

  describe('code', () => {
    it('is required', () => {
      expect(procedureFormSchema.safeParse({ ...base, code: '   ' }).success).toBe(false);
    });

    it('rejects codes longer than 20 chars', () => {
      expect(procedureFormSchema.safeParse({ ...base, code: 'X'.repeat(21) }).success).toBe(false);
      expect(procedureFormSchema.safeParse({ ...base, code: 'X'.repeat(20) }).success).toBe(true);
    });

    it('rejects characters outside [A-Za-z0-9_-] (backend uppercases valid input)', () => {
      // Zod trims first, so an internal space still fails the regex.
      expect(procedureFormSchema.safeParse({ ...base, code: 'RC T' }).success).toBe(false);
      expect(procedureFormSchema.safeParse({ ...base, code: 'RCT.CODE' }).success).toBe(false);
      expect(procedureFormSchema.safeParse({ ...base, code: 'rct_code-1' }).success).toBe(true);
    });
  });

  describe('name', () => {
    it('is required', () => {
      expect(procedureFormSchema.safeParse({ ...base, name: '' }).success).toBe(false);
    });

    it('rejects names longer than 200 chars', () => {
      expect(procedureFormSchema.safeParse({ ...base, name: 'N'.repeat(201) }).success).toBe(false);
      expect(procedureFormSchema.safeParse({ ...base, name: 'N'.repeat(200) }).success).toBe(true);
    });
  });

  describe('description', () => {
    it('accepts empty descriptions', () => {
      expect(procedureFormSchema.safeParse({ ...base, description: '' }).success).toBe(true);
    });

    it('rejects descriptions longer than 2000 chars', () => {
      expect(procedureFormSchema.safeParse({ ...base, description: 'D'.repeat(2001) }).success).toBe(false);
      expect(procedureFormSchema.safeParse({ ...base, description: 'D'.repeat(2000) }).success).toBe(true);
    });
  });

  describe('default_cost', () => {
    it('is required', () => {
      expect(procedureFormSchema.safeParse({ ...base, default_cost: '' }).success).toBe(false);
    });

    it('rejects negative costs', () => {
      expect(procedureFormSchema.safeParse({ ...base, default_cost: '-1' }).success).toBe(false);
    });

    it('rejects costs above 999999.99', () => {
      expect(procedureFormSchema.safeParse({ ...base, default_cost: '1000000' }).success).toBe(false);
      expect(procedureFormSchema.safeParse({ ...base, default_cost: '999999.99' }).success).toBe(true);
    });

    it('rejects non-numeric input', () => {
      expect(procedureFormSchema.safeParse({ ...base, default_cost: 'abc' }).success).toBe(false);
      expect(procedureFormSchema.safeParse({ ...base, default_cost: '12.5.5' }).success).toBe(false);
    });

    it('accepts zero', () => {
      expect(procedureFormSchema.safeParse({ ...base, default_cost: '0' }).success).toBe(true);
    });
  });

  describe('category', () => {
    it('is required', () => {
      expect(procedureFormSchema.safeParse({ ...base, category: '' }).success).toBe(false);
    });

    it('rejects values outside the 11-category enum (backend 422)', () => {
      expect(procedureFormSchema.safeParse({ ...base, category: 'surgery' }).success).toBe(false);
    });

    it('accepts every documented category', () => {
      for (const category of PROCEDURE_CATEGORIES) {
        expect(procedureFormSchema.safeParse({ ...base, category }).success).toBe(true);
      }
    });
  });
});
