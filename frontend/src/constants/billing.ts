/**
 * Billing module constants.
 *
 * Maintains alignment with backend `app/modules/billing/`:
 * - enums.py  (InvoiceStatus, PaymentStatus, PaymentMethod, CurrencyCode)
 * - schemas/  (dashboard totals, invoice/payment list items)
 *
 * Status maps feed the shared `StatusBadge` component's `statusMap` prop —
 * no parallel badge system is introduced.
 */
import type { BadgeVariant } from '../components/common/Badge/badge.types';
import type {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '../types/billing';

/* ── Status presentation (backend enums → badge variants) ─────────── */

/**
 * Invoice status → BadgeVariant map. Text labels (not colour alone) are
 * rendered by `StatusBadge`, so statuses remain distinguishable for
 * colour-blind users (WCAG 1.4.1).
 */
export const INVOICE_STATUS_VARIANTS: Record<InvoiceStatus, BadgeVariant> = {
  draft: 'neutral',
  issued: 'info',
  partially_paid: 'warning',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'danger',
  void: 'neutral',
};

/** Payment status → BadgeVariant map (same no-colour-only guarantee). */
export const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, BadgeVariant> = {
  pending: 'warning',
  completed: 'success',
  failed: 'danger',
  refunded: 'info',
  reversed: 'neutral',
  void: 'neutral',
};

/* ── Payment method display labels (display only) ─────────────────── */

/** Backend `PaymentMethod` enum → human-readable label. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  insurance: 'Insurance',
  wallet: 'Wallet',
};
