/**
 * Zod schema for the Create Treatment Plan form.
 *
 * Mirrors the backend `CreatePlanRequest` bounds ([BCR §5.1]) exactly:
 * - `patient_id` / `doctor_id` required (backend 404s on unknown ids).
 * - Notes fields nullable, 1–5000 when present.
 * - `valid_from` / `valid_to` are `YYYY-MM-DD`; `valid_from ≤ valid_to`
 *   (backend 422 `INVALID_DATE_RANGE`).
 * - `plan_code` optional, ≤ 20, stored verbatim (O10).
 *
 * NOTE: all header fields are CREATE-ONLY (O1) — this form is the only
 * chance to set them, so every bound is enforced client-side.
 */
import { z } from 'zod';
import type { PlanFormValues } from '../types/treatmentPlan';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const createPlanFormSchema = z
  .object({
    patient_id: z.string().min(1, 'Patient is required'),
    doctor_id: z.string().min(1, 'Doctor is required'),
    clinical_notes: z
      .string()
      .trim()
      .refine((v) => v.length === 0 || v.length <= 5000, {
        message: 'Clinical notes must be at most 5000 characters',
      }),
    observations: z
      .string()
      .trim()
      .refine((v) => v.length === 0 || v.length <= 5000, {
        message: 'Observations must be at most 5000 characters',
      }),
    dentist_recommendations: z
      .string()
      .trim()
      .refine((v) => v.length === 0 || v.length <= 5000, {
        message: 'Dentist recommendations must be at most 5000 characters',
      }),
    valid_from: z
      .string()
      .refine((v) => v === '' || DATE_PATTERN.test(v), {
        message: 'Valid from must be a valid date (YYYY-MM-DD)',
      }),
    valid_to: z
      .string()
      .refine((v) => v === '' || DATE_PATTERN.test(v), {
        message: 'Valid to must be a valid date (YYYY-MM-DD)',
      }),
    plan_code: z
      .string()
      .trim()
      .refine((v) => v.length === 0 || v.length <= 20, {
        message: 'Plan code must be at most 20 characters',
      }),
  })
  .superRefine((values, ctx) => {
    if (values.valid_from && values.valid_to && values.valid_from > values.valid_to) {
      ctx.addIssue({
        code: 'custom',
        path: ['valid_to'],
        message: 'Valid to must be on or after valid from',
      });
    }
  });

export type CreatePlanFormValues = PlanFormValues;

/** Default (empty) values for the create-plan form. */
export const defaultCreatePlanValues: CreatePlanFormValues = {
  patient_id: '',
  doctor_id: '',
  clinical_notes: '',
  observations: '',
  dentist_recommendations: '',
  valid_from: '',
  valid_to: '',
  plan_code: '',
};
