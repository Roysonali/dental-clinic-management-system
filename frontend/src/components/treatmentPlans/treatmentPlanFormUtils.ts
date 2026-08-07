import type { CreatePlanRequest, PlanFormValues } from '../../types/treatmentPlan';

/**
 * Create Plan form transformer.
 *
 * Presentational `PlanFormValues` are never sent to the API as-is: dates
 * are empty strings in the form but must be omitted (or null) in the
 * request, and trimmed note fields become `null` instead of '' (the backend
 * `CreatePlanRequest` allows nullables; empty strings are also accepted but
 * null is the canonical empty — matching how the backend stores unset
 * clinical fields).
 */
export function planFormValuesToRequest(values: PlanFormValues): CreatePlanRequest {
  const toNullable = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const request: CreatePlanRequest = {
    patient_id: values.patient_id,
    doctor_id: values.doctor_id,
    clinical_notes: toNullable(values.clinical_notes),
    observations: toNullable(values.observations),
    dentist_recommendations: toNullable(values.dentist_recommendations),
  };

  if (values.valid_from) request.valid_from = values.valid_from;
  if (values.valid_to) request.valid_to = values.valid_to;
  const code = values.plan_code.trim();
  if (code) request.plan_code = code;

  return request;
}
