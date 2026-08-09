/**
 * Zod schemas for the Credit Note module forms (Sprint 14A.4).
 *
 * Mirrors the backend bounds that are actually enforced at runtime:
 * - `CreditNoteCreateRequest` (schemas/credit_note.py): invoice_id, patient_id,
 *   amount (positive, <= invoice grand total — BR-91, FI-CN-002), reason
 *   (validator enforces `CREDIT_NOTE_REASON_MAX_LENGTH` = 500),
 *   expiry_date optional.
 * - `CreditNoteVoidRequest` (schemas/credit_note.py): void_reason required
 *   (schema max 1000; the frontend conservatively caps at
 *   `CREDIT_NOTE_VOID_REASON_MAX_LENGTH` = 500, which the backend accepts).
 */

import { z } from 'zod';
import { CREDIT_NOTE_REASON_MAX_LENGTH, CREDIT_NOTE_VOID_REASON_MAX_LENGTH } from '../constants/billing';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a money input ("", "10", "10.5") → finite number or NaN. */
export function parseCreditNoteMoney(value: string): number {
  if (value === undefined || value === null) return Number.NaN;
  const trimmed = String(value).trim();
  if (trimmed === '') return 0;
  return Number(trimmed);
}

export interface CreditNoteCreateFormValues {
  invoice_id: string;
  patient_id: string;
  amount: string;
  reason: string;
  /** Optional — omitted (undefined) rather than '' when submitting. */
  expiry_date?: string;
}

export const creditNoteCreateFormSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice is required'),
  patient_id: z.string().min(1, 'Patient is required'),
  amount: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(parseCreditNoteMoney(v)) && parseCreditNoteMoney(v) > 0, {
      message: 'Amount must be greater than 0',
    }),
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(CREDIT_NOTE_REASON_MAX_LENGTH, `Reason must be at most ${CREDIT_NOTE_REASON_MAX_LENGTH} characters`),
  expiry_date: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || DATE_PATTERN.test(v),
      'Enter a valid date (YYYY-MM-DD)',
    ),
});

export interface CreditNoteVoidFormValues {
  void_reason: string;
}

export const creditNoteVoidFormSchema = z.object({
  void_reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(CREDIT_NOTE_VOID_REASON_MAX_LENGTH, `Reason must be at most ${CREDIT_NOTE_VOID_REASON_MAX_LENGTH} characters`),
});

export type CreditNoteCreateFormValuesInferred = z.infer<typeof creditNoteCreateFormSchema>;
export type CreditNoteVoidFormValuesInferred = z.infer<typeof creditNoteVoidFormSchema>;
