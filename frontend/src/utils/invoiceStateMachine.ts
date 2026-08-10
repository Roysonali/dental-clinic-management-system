import type { InvoiceStatus } from '../types/billing';

/**
 * Invoice lifecycle action model (Sprint 14A.2).
 *
 * Mirrors the backend state machine EXACTLY:
 * - `INVOICE_TRANSITIONS` (billing/constants.py) — the single source of truth
 *   for legal transitions.
 * - `routers/invoice.py` exposes only issue / cancel / update / delete —
 *   there is NO void endpoint, so a PAID invoice (whose only outgoing
 *   transition is `void`) exposes NO lifecycle actions.
 *
 * Draft:      issue, edit, cancel, delete (delete additionally admin-gated
 *             via PermissionGate — backend `_INVOICE_DELETE_ROLES` = ADMIN).
 * Issued/Partial/Overdue: cancel (backend cancel endpoint accepts any
 *             non-terminal status; the state machine allows these → cancelled).
 * Paid:       none — the only legal transition is `void`, which the router
 *             does not expose.
 * Cancelled/Void: none (terminal).
 */

export type InvoiceActionId = 'issue' | 'edit' | 'cancel' | 'delete';

/** Lifecycle actions available for a given backend status. */
export function getInvoiceActions(status: InvoiceStatus): InvoiceActionId[] {
  switch (status) {
    case 'draft':
      return ['issue', 'edit', 'cancel', 'delete'];
    case 'issued':
    case 'partially_paid':
    case 'overdue':
      return ['cancel'];
    case 'paid':
    case 'cancelled':
    case 'void':
      return [];
  }
}

/** Human-readable labels for each invoice lifecycle action. */
export const INVOICE_ACTION_LABELS: Record<InvoiceActionId, string> = {
  issue: 'Issue',
  edit: 'Edit',
  cancel: 'Cancel',
  delete: 'Delete',
};

/** A draft has no permanent number — its backend number is a DRAFT-xxxxxx temp. */
export function isDraftInvoice(status: InvoiceStatus): boolean {
  return status === 'draft';
}
