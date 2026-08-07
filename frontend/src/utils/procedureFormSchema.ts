/**
 * Zod schema for the Procedure create/edit form.
 *
 * Mirrors the backend `ProcedureCreate` / `ProcedureUpdate` bounds
 * ([BCR §5.6]):
 * - `code` 1–20 chars matching `[A-Za-z0-9_-]+` (backend uppercases).
 * - `name` 1–200 chars, non-empty after strip.
 * - `default_cost` 0–999999.99.
 * - `category` must be one of the 11 ProcedureCategory values (422).
 * - `description` ≤ 2000.
 *
 * NOTE: `code` is IMMUTABLE on edit (absent from `ProcedureUpdate`, 422 on
 * unknown fields) — the edit form must not send it.
 */
import { z } from 'zod';
import { PROCEDURE_CATEGORIES } from '../constants/procedure';
import type { ProcedureFormValues } from '../types/procedure';

const CATEGORY_VALUES: readonly string[] = [...PROCEDURE_CATEGORIES];
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

export const procedureFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(20, 'Code must be at most 20 characters')
    .regex(CODE_PATTERN, 'Code may only contain letters, numbers, underscore and dash'),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  description: z
    .string()
    .trim()
    .refine((v) => v.length <= 2000, {
      message: 'Description must be at most 2000 characters',
    }),
  default_cost: z
    .string()
    .min(1, 'Default cost is required')
    .refine((v) => {
      const numeric = Number(v);
      return Number.isFinite(numeric) && numeric >= 0 && numeric <= 999999.99;
    }, { message: 'Default cost must be between 0 and 999999.99' }),
  category: z
    .string()
    .min(1, 'Category is required')
    .refine((v) => CATEGORY_VALUES.includes(v), { message: 'Category is invalid' }),
});

/** Empty values for the create-procedure form. */
export const defaultProcedureFormValues: ProcedureFormValues = {
  code: '',
  name: '',
  description: '',
  default_cost: '',
  category: '',
};
