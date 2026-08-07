import { describe, it, expect } from 'vitest';
import { planFormValuesToRequest } from './treatmentPlanFormUtils';
import type { PlanFormValues } from '../../types/treatmentPlan';

const base: PlanFormValues = {
  patient_id: 'p1',
  doctor_id: 'd1',
  clinical_notes: '  Notes  ',
  observations: '',
  dentist_recommendations: 'Recommend',
  valid_from: '2026-08-01',
  valid_to: '2026-08-31',
  plan_code: '',
};

describe('planFormValuesToRequest', () => {
  it('maps trimmed fields and omits empty optionals', () => {
    const request = planFormValuesToRequest(base);
    expect(request).toEqual({
      patient_id: 'p1',
      doctor_id: 'd1',
      clinical_notes: 'Notes',
      observations: null,
      dentist_recommendations: 'Recommend',
      valid_from: '2026-08-01',
      valid_to: '2026-08-31',
    });
  });

  it('omits plan_code when blank (auto TXN-XXXXXX on the backend)', () => {
    expect('plan_code' in planFormValuesToRequest(base)).toBe(false);
  });

  it('includes plan_code only when provided', () => {
    const request = planFormValuesToRequest({ ...base, plan_code: '  MY-PLAN  ' });
    expect(request.plan_code).toBe('MY-PLAN');
  });
});
