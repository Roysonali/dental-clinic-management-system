/**
 * Zod schema for the Create Refund drawer form (Sprint 14A.5).
 *
 * Mirrors backend bounds EXACTLY (backend remains authoritative — these are
 * UX-grade previews):
 * - `RefundCreateRequest` (schemas/refund.py): payment_id required; amount
 *   PositiveDecimal (> 0, 2dp) and <= refundable balance (enforced by
 *   `RefundService.create_refund` via `RefundExceedsPayment`); reason
 *   required, max 1000.
 * - `MAX_MONEY_AMOUNT` (constants.py) = 999999999999.99.
 *
 * The refundable balance is dynamic (payment total − already refunded), so
 * the schema is produced by a factory that bakes the current balance in.
 */
import { z } from 'zod';
import { REFUND_REASON_MAX_LENGTH } from '../constants/billing';

/** Parse a money input ("", "10", "10.50") → finite number or NaN. */
export function parseRefundMoney(value: string): number {
  if (value === undefined || value === null) return Number.NaN;
  const trimmed = String(value).trim();
  if (trimmed === '') return Number.NaN;
  return Number(trimmed);
}

export interface RefundFormValues {
  /** The payment being refunded (pre-selected from the payment detail page). */
  payment_id: string;
  /** DOM string for the amount input (converted in refundFormUtils). */
  amount: string;
  reason: string;
}

/**
 * Build the create-refund schema for a given refundable balance.
 *
 * `refundableBalance` is the payment total minus already-refunded amount
 * (completed refunds), derived from the payment aggregate the drawer opens
 * with. The backend remains the authority — this gates the UX only.
 */
export function createRefundFormSchema(refundableBalance: number) {
  return z.object({
    payment_id: z.string().min(1, 'Select a payment to refund'),
    amount: z
      .string()
      .trim()
      .refine((v) => !Number.isNaN(parseRefundMoney(v)), {
        message: 'Enter a valid amount',
      })
      .refine((v) => parseRefundMoney(v) > 0, {
        message: 'Amount must be greater than 0',
      })
      .refine((v) => parseRefundMoney(v) <= 999999999999.99, {
        message: 'Amount is too large',
      })
      .refine((v) => parseRefundMoney(v) <= refundableBalance, {
        message: `Amount cannot exceed the refundable balance (${refundableBalance.toFixed(2)})`,
      }),
    reason: z
      .string()
      .trim()
      .min(1, 'Enter a reason for this refund')
      .max(REFUND_REASON_MAX_LENGTH, `Reason must be at most ${REFUND_REASON_MAX_LENGTH} characters`),
  });
}

export type RefundFormValuesForZod = RefundFormValues;
