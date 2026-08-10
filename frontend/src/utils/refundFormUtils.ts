/**
 * Refund form conversion utilities (Sprint 14A.5).
 *
 * Converts react-hook-form values into the exact backend request payload.
 * The amount is quantized to 2dp (backend NUMERIC(12,2)) — a UX preview
 * only; the backend remains the financial authority.
 */
import {
  REFUND_REASON_MAX_LENGTH,
} from '../constants/billing';
import type { RefundCreatePayload } from '../types/billing';
import { parseRefundMoney, type RefundFormValues } from './refundFormSchema';

/** Round a money value to 2 decimals (backend quantizes to NUMERIC(12,2)). */
export function quantizeRefundMoney(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return Math.max(0, value).toFixed(2);
}

/** Default values for the Create Refund form (payment pre-selected). */
export function defaultRefundFormValues(paymentId: string): RefundFormValues {
  return {
    payment_id: paymentId,
    amount: '',
    reason: '',
  };
}

/** Convert the create form into the POST /billing/refunds payload. */
export function refundFormValuesToCreatePayload(
  values: RefundFormValues,
): RefundCreatePayload {
  return {
    payment_id: values.payment_id,
    amount: quantizeRefundMoney(parseRefundMoney(values.amount)),
    reason: values.reason.trim().slice(0, REFUND_REASON_MAX_LENGTH),
  };
}
