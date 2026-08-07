import { describe, it, expect } from 'vitest';
import { createPlanFormSchema } from './treatmentPlanFormSchema';

describe('createPlanFormSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createPlanFormSchema.safeParse({
      patient_id: 'p1',
      doctor_id: 'd1',
      clinical_notes: '',
      observations: '',
      dentist_recommendations: '',
      valid_from: '',
      valid_to: '',
      plan_code: '',
    });
    expect(result.success).toBe(true);
  });

  it('requires patient and doctor', () => {
    const result = createPlanFormSchema.safeParse({
      patient_id: '',
      doctor_id: '',
      clinical_notes: '',
      observations: '',
      dentist_recommendations: '',
      valid_from: '',
      valid_to: '',
      plan_code: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'patient_id')).toBe(true);
      expect(result.error.issues.some((i) => i.path[0] === 'doctor_id')).toBe(true);
    }
  });

  it('rejects notes longer than 5000 chars', () => {
    const result = createPlanFormSchema.safeParse({
      patient_id: 'p1',
      doctor_id: 'd1',
      clinical_notes: 'x'.repeat(5001),
      observations: '',
      dentist_recommendations: '',
      valid_from: '',
      valid_to: '',
      plan_code: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a valid_to before valid_from', () => {
    const result = createPlanFormSchema.safeParse({
      patient_id: 'p1',
      doctor_id: 'd1',
      clinical_notes: '',
      observations: '',
      dentist_recommendations: '',
      valid_from: '2026-08-10',
      valid_to: '2026-08-01',
      plan_code: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'valid_to')).toBe(true);
    }
  });

  it('rejects a non ISO date format (O6 — YYYY-MM-DD only)', () => {
    const result = createPlanFormSchema.safeParse({
      patient_id: 'p1',
      doctor_id: 'd1',
      clinical_notes: '',
      observations: '',
      dentist_recommendations: '',
      valid_from: '08/01/2026',
      valid_to: '',
      plan_code: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects plan codes longer than 20 chars', () => {
    const result = createPlanFormSchema.safeParse({
      patient_id: 'p1',
      doctor_id: 'd1',
      clinical_notes: '',
      observations: '',
      dentist_recommendations: '',
      valid_from: '',
      valid_to: '',
      plan_code: 'X'.repeat(21),
    });
    expect(result.success).toBe(false);
  });
});
