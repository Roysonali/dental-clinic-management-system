/**
 * Credit Note state machine helpers (Sprint 14A.4).
 *
 * Mirrors backend `CREDIT_NOTE_TRANSITIONS` in `app/modules/billing/constants.py`.
 * Do NOT invent transitions — the backend is the single source of truth.
 */

import type { CreditNoteStatus } from '../types/billing';

/**
 * Allowed transitions from a given credit note status.
 *
 * DRAFT → ISSUED, VOID
 * ISSUED → APPLIED, VOID, EXPIRED
 * APPLIED → (none — terminal)
 * VOID → (none — terminal)
 * EXPIRED → (none — terminal)
 */
const TRANSITIONS: Record<CreditNoteStatus, Set<CreditNoteStatus>> = {
  draft: new Set(['issued', 'void']),
  issued: new Set(['applied', 'void', 'expired']),
  applied: new Set(),
  void: new Set(),
  expired: new Set(),
};

/**
 * Return the set of statuses that can transition TO the given target.
 */
export function canTransitionTo(current: CreditNoteStatus, target: CreditNoteStatus): boolean {
  return TRANSITIONS[current]?.has(target) ?? false;
}

/**
 * Return whether the credit note is in a terminal state (no outgoing transitions).
 */
export function isTerminalStatus(status: CreditNoteStatus): boolean {
  return TRANSITIONS[status]?.size === 0;
}

/**
 * Return whether the credit note is editable (Draft only).
 */
export function isEditableStatus(status: CreditNoteStatus): boolean {
  return status === 'draft';
}

/**
 * Map credit note status to display label.
 */
export function creditNoteStatusLabel(status: CreditNoteStatus): string {
  const labels: Record<CreditNoteStatus, string> = {
    draft: 'Draft',
    issued: 'Issued',
    applied: 'Applied',
    void: 'Void',
    expired: 'Expired',
  };
  return labels[status] ?? status;
}
