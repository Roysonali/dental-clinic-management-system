import type { PaymentStatus } from '../types/billing';

/**
 * Payment lifecycle action model (Sprint 14A.3).
 *
 * Mirrors the backend state machine EXACTLY:
 * - `PAYMENT_TRANSITIONS` (billing/constants.py) — the single source of truth
 *   for legal transitions:
 *     PENDING → {COMPLETED, FAILED, VOID}
 *     COMPLETED → {REFUNDED, REVERSED}
 *     FAILED → {PENDING}
 *     VOID / REFUNDED / REVERSED → terminal
 * - `routers/payment.py` exposes complete / fail / void / allocate /
 *   deallocate / delete — there is NO endpoint for FAILED→PENDING (retry),
 *   COMPLETED→REFUNDED or COMPLETED→REVERSED (those are separate Refund /
 *   reversal workflows), so the UI never shows them.
 *
 * Pending:  complete, fail, void, delete (delete additionally admin-gated via
 *           PermissionGate — backend `_PAYMENT_DELETE_ROLES` = ADMIN).
 * Completed: allocate (further gated in the UI on unallocated_amount > 0).
 * Failed / Refunded / Reversed / Void: none (no router-exposed transitions).
 */
export type PaymentActionId =
  | 'complete'
  | 'fail'
  | 'void'
  | 'delete'
  | 'allocate'
  /** Create Refund — not returned by getPaymentActions (the backend exposes
   *  a separate /billing/refunds workflow); the payment detail page adds it
   *  for completed payments with a refundable balance. */
  | 'refund';

/** Lifecycle actions available for a given backend status. */
export function getPaymentActions(status: PaymentStatus): PaymentActionId[] {
  switch (status) {
    case 'pending':
      return ['complete', 'fail', 'void', 'delete'];
    case 'completed':
      return ['allocate'];
    case 'failed':
    case 'refunded':
    case 'reversed':
    case 'void':
      return [];
  }
}

/** Human-readable labels for each payment lifecycle action. */
export const PAYMENT_ACTION_LABELS: Record<PaymentActionId, string> = {
  complete: 'Complete',
  fail: 'Mark as failed',
  void: 'Void',
  delete: 'Delete',
  allocate: 'Allocate',
  refund: 'Create refund',
};

/** A payment is only editable/deletable in Pending status (backend rule). */
export function isPendingPayment(status: PaymentStatus): boolean {
  return status === 'pending';
}
