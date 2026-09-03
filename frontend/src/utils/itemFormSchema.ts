/**
 * Zod schema for the Add/Update plan item forms.
 *
 * Mirrors the backend `AddItemRequest` / `ItemUpdateRequest` bounds
 * ([BCR §5.2/§5.3]):
 * - `procedure_id` / `sequence_number` required on create.
 * - Tooth number validated against FDI ranges 11–48 / 51–85 (backend 422
 *   `INVALID_TOOTH_NUMBER` — e.g. 49 is rejected).
 * - Cost 0–999999.99; discount ≥ 0 and ≤ cost (backend 422 + DB CHECK).
 * - Tooth-surface format is deliberately NOT enforced client-side as a hard
 *   block — the backend accepts any 1–10 char string (O8); only a length
 *   bound is applied (matching the backend).
 */
import { z } from 'zod';
import { isValidFdiToothNumber, TOOTH_ARCHES, TOOTH_QUADRANTS } from '../constants/treatmentPlan';
import type { ItemFormValues } from '../types/treatmentPlan';

/** Parse a money field into a finite number (0 when empty). */
function toNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

const QUADRANT_VALUES: readonly string[] = [...TOOTH_QUADRANTS];
const ARCH_VALUES: readonly string[] = [...TOOTH_ARCHES];

export const itemFormSchema = z
  .object({
    procedure_id: z.string().min(1, 'Procedure is required'),
    sequence_number: z
      .string()
      .min(1, 'Sequence number is required')
      .refine((v) => Number.isInteger(toNumber(v)) && toNumber(v) >= 1, {
        message: 'Sequence number must be a positive integer',
      }),
    quantity: z
      .string()
      .refine(
        (v) => v === '' || (Number.isInteger(toNumber(v)) && toNumber(v) >= 1 && toNumber(v) <= 999),
        { message: 'Quantity must be between 1 and 999' },
      ),
    tooth_number: z
      .string()
      .refine(
        (v) =>
          v === '' ||
          (Number.isInteger(toNumber(v)) && isValidFdiToothNumber(toNumber(v))),
        { message: 'Tooth number must be in FDI range (11–48, 51–85)' },
      ),
    tooth_surface: z
      .string()
      .trim()
      .refine((v) => v.length <= 10, {
        message: 'Tooth surface must be at most 10 characters',
      }),
    quadrant: z
      .string()
      .refine((v) => v === '' || QUADRANT_VALUES.includes(v), {
        message: 'Quadrant is invalid',
      }),
    arch: z.string().refine((v) => v === '' || ARCH_VALUES.includes(v), {
      message: 'Arch is invalid',
    }),
    estimated_cost: z
      .string()
      .refine(
        (v) => v === '' || (toNumber(v) >= 0 && toNumber(v) <= 999999.99),
        { message: 'Estimated cost must be between 0 and 999999.99' },
      ),
    discount: z
      .string()
      .refine((v) => v === '' || (toNumber(v) >= 0 && toNumber(v) <= 999999.99), {
        message: 'Discount must be between 0 and 999999.99',
      }),
    notes: z
      .string()
      .trim()
      .refine((v) => v.length <= 5000, {
        message: 'Notes must be at most 5000 characters',
      }),
  })
  .superRefine((values, ctx) => {
    if (values.estimated_cost !== '' && values.discount !== '') {
      const cost = toNumber(values.estimated_cost);
      const discount = toNumber(values.discount);
      if (Number.isFinite(cost) && Number.isFinite(discount) && discount > cost) {
        ctx.addIssue({
          code: 'custom',
          path: ['discount'],
          message: 'Discount cannot exceed the estimated cost',
        });
      }
    }
  });

/** Empty values for the add-item form. */
export const defaultItemFormValues: ItemFormValues = {
  procedure_id: '',
  sequence_number: '',
  quantity: '1',
  tooth_number: '',
  tooth_surface: '',
  quadrant: '',
  arch: '',
  estimated_cost: '',
  discount: '',
  notes: '',
};
