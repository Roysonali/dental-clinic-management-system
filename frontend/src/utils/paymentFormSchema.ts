/**
 * Zod schema for the Record Payment form (Sprint 14A.3).
 *
 * Mirrors backend bounds EXACTLY (backend remains authoritative — these are
 * UX-grade previews):
 * - `PaymentCreateRequest` (schemas/payment.py): patient_id required;
 *   payment_method required; total_amount PositiveDecimal (> 0, 2dp);
 *   payment_date required; reference_number <= 100; notes <= 500.
 * - `MAX_MONEY_AMOUNT` (constants.py) = 999999999999.99.
 */
import { z } from 'zod';
import {
  PAYMENT_NOTES_MAX_LENGTH,
  PAYMENT_REFERENCE_MAX_LENGTH,
} from '../constants/billing';
import type { PaymentMethod } from '../types/billing';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ERROR = 'Enter a valid date (YYYY-MM-DD)';

/** Parse a money input ("", "10", "10.50") → finite number or NaN. */
export function parseMoney(value: string): number {
  if (value === undefined || value === null) return Number.NaN;
  const trimmed = String(value).trim();
  if (trimmed === '') return Number.NaN;
  return Number(trimmed);
}

export interface PaymentFormValues {
  patient_id: string;
  /** '' while unset; a backend PaymentMethod once chosen. */
  payment_method: PaymentMethod | '';
  /** DOM string for the amount input (converted in paymentFormUtils). */
  total_amount: string;
  payment_date: string;
  reference_number: string;
  notes: string;
}

export const paymentFormSchema = z.object({
  patient_id: z.string().min(1, 'Select a patient for this payment'),
  payment_method: z
    .union([
      z.literal(''),
      z.literal('cash'),
      z.literal('card'),
      z.literal('upi'),
      z.literal('bank_transfer'),
      z.literal('cheque'),
      z.literal('insurance'),
      z.literal('wallet'),
    ])
    .refine((v) => v !== '', 'Select a payment method'),
  total_amount: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(parseMoney(v)), {
      message: 'Enter a valid amount',
    })
    .refine((v) => parseMoney(v) > 0, {
      message: 'Amount must be greater than 0',
    })
    .refine((v) => parseMoney(v) <= 999999999999.99, {
      message: 'Amount is too large',
    }),
  payment_date: z.string().refine((v) => DATE_PATTERN.test(v), {
    message: DATE_ERROR,
  }),
  reference_number: z
    .string()
    .refine((v) => v.length <= PAYMENT_REFERENCE_MAX_LENGTH, {
      message: `Reference must be at most ${PAYMENT_REFERENCE_MAX_LENGTH} characters`,
    }),
  notes: z
    .string()
    .refine((v) => v.length <= PAYMENT_NOTES_MAX_LENGTH, {
      message: `Notes must be at most ${PAYMENT_NOTES_MAX_LENGTH} characters`,
    }),
});

export type PaymentFormValuesForZod = PaymentFormValues;
