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
  CurrencyCode,
  InvoiceDiscountType,
  InvoiceSortField,
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

/* ── Invoice module list / form constants (Sprint 14A.2) ──────────── */

/** Default rows-per-page for GET /billing/invoices (backend default 20). */
export const INVOICE_LIST_PAGE_SIZE = 20;

/** Rows-per-page options (respects backend max page_size of 100). */
export const INVOICE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Invoice status options for the list Status filter (all backend values). */
export const INVOICE_STATUS_OPTIONS: readonly { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'void', label: 'Void' },
];

/** Server-side sort options for the list (backend `ALLOWED_SORT_FIELDS`). */
export const INVOICE_SORT_OPTIONS: readonly { value: InvoiceSortField; label: string }[] = [
  { value: 'created_at', label: 'Created date' },
  { value: 'invoice_number', label: 'Invoice number' },
  { value: 'grand_total', label: 'Grand total' },
  { value: 'status', label: 'Status' },
  { value: 'due_date', label: 'Due date' },
  { value: 'updated_at', label: 'Updated date' },
];

/** ISO 4217 currencies the billing module supports (backend CurrencyCode). */
export const CURRENCY_OPTIONS: readonly { value: CurrencyCode; label: string }[] = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'INR', label: 'INR — Indian Rupee' },
];

/** Line-item discount types (backend `InvoiceItemBase.discount_type`). */
export const INVOICE_DISCOUNT_TYPE_OPTIONS: readonly {
  value: InvoiceDiscountType;
  label: string;
}[] = [
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
  { value: 'FIXED_AMOUNT', label: 'Fixed amount ($)' },
];

/* ── Field length limits mirrored from backend constants.py ───────── */

/** `INVOICE_NUMBER_MAX_LENGTH` — max invoice number length. */
export const INVOICE_NUMBER_MAX_LENGTH = 30;
/** `notes` max length on InvoiceBase (backend schema says 2000, not 500). */
export const INVOICE_NOTES_MAX_LENGTH = 2000;
/** `CANCEL_REASON_MAX_LENGTH` — cancellation reason max. */
export const INVOICE_CANCEL_REASON_MAX_LENGTH = 500;
/** Line-item `description` max length (InvoiceItemBase). */
export const INVOICE_ITEM_DESCRIPTION_MAX_LENGTH = 500;
/** Minimum line items per invoice (MIN_LINE_ITEMS_PER_INVOICE). */
export const INVOICE_MIN_LINE_ITEMS = 1;
/** Minimum line-item quantity (MIN_LINE_ITEM_QUANTITY). */
export const INVOICE_MIN_ITEM_QUANTITY = 1;

