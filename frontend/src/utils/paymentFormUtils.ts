/**
 * Payment form conversion utilities (Sprint 14A.3).
 *
 * Converts react-hook-form values into the exact backend request payloads.
 * The amount is quantized to 2dp (backend NUMERIC(12,2)) — a UX preview
 * only; the backend remains the financial authority.
 */
import { todayLocalISO } from './date';
import {
  PAYMENT_NOTES_MAX_LENGTH,
  PAYMENT_REFERENCE_MAX_LENGTH,
} from '../constants/billing';
import type {
  PaymentCreatePayload,
  PaymentRead,
} from '../types/billing';
import {
  parseMoney,
  type PaymentFormValues,
} from './paymentFormSchema';

/** Round a money value to 2 decimals (backend quantizes to NUMERIC(12,2)). */
export function quantizeMoney(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return Math.max(0, value).toFixed(2);
}

/** Default values for the Record Payment form. */
export function defaultPaymentFormValues(): PaymentFormValues {
  return {
    patient_id: '',
    payment_method: '',
    total_amount: '',
    payment_date: todayLocalISO(),
    reference_number: '',
    notes: '',
  };
}

/** Convert the create form into POST /billing/payments payload. */
export function paymentFormValuesToCreatePayload(
  values: PaymentFormValues,
): PaymentCreatePayload {
  const payload: PaymentCreatePayload = {
    patient_id: values.patient_id,
    payment_method: values.payment_method as PaymentCreatePayload['payment_method'],
    total_amount: quantizeMoney(parseMoney(values.total_amount)),
    payment_date: values.payment_date,
  };
  const reference = values.reference_number.trim().slice(0, PAYMENT_REFERENCE_MAX_LENGTH);
  if (reference) payload.reference_number = reference;
  const notes = values.notes.trim().slice(0, PAYMENT_NOTES_MAX_LENGTH);
  if (notes) payload.notes = notes;
  return payload;
}

/** Prefill metadata for a Pending payment (reference + notes only). */
export function paymentToEditFormValues(payment: PaymentRead): Pick<PaymentFormValues, 'reference_number' | 'notes'> {
  return {
    reference_number: payment.reference_number ?? '',
    notes: payment.notes ?? '',
  };
}
