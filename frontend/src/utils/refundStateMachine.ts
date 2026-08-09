/**
 * Refund state machine helpers (Sprint 14A.5).
 *
 * Mirrors backend `REFUND_TRANSITIONS` in `app/modules/billing/constants.py`
 * exactly — the backend is the single source of truth:
 *
 *   PENDING  → { APPROVED, REJECTED }
 *   APPROVED → { COMPLETED }
 *   REJECTED → (none — terminal)
 *   COMPLETED→ (none — terminal)
 *
 * The router additionally only exposes approve / reject / complete, so the
 * UI never offers any other transition.
 */

import type { RefundStatus } from '../types/billing';

/** Allowed outgoing transitions per backend status. */
const TRANSITIONS: Record<RefundStatus, Set<RefundStatus>> = {
  pending: new Set(['approved', 'rejected']),
  approved: new Set(['completed']),
  rejected: new Set(),
  completed: new Set(),
};

/** Return whether `current` may transition TO `target` (backend transition table). */
export function canTransitionTo(current: RefundStatus, target: RefundStatus): boolean {
  return TRANSITIONS[current]?.has(target) ?? false;
}

/** Return whether the refund is in a terminal state (no outgoing transitions). */
export function isTerminalStatus(status: RefundStatus): boolean {
  return TRANSITIONS[status]?.size === 0;
}

/** Return whether the refund is editable (Pending only — backend rule). */
export function isEditableStatus(status: RefundStatus): boolean {
  return status === 'pending';
}

/** Map a refund status to its display label. */
export function refundStatusLabel(status: RefundStatus): string {
  const labels: Record<RefundStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',
  };
  return labels[status] ?? status;
}
