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
  CreditNoteStatus,
  PaymentMethod,
  PaymentSortField,
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

/* ── Mobile list status presentation (reference mobile screens) ────── */

/**
 * Invoice status → BadgeVariant map for the MOBILE card list ONLY.
 *
 * The reference mobile screens (47/48) specify their own pastel pill
 * colours: ISSUED blue, DRAFT gray, OVERDUE amber, PAID green,
 * PARTIALLY PAID blue. The desktop tables keep the existing desktop map
 * above untouched (no desktop regression) — these maps exist solely to
 * reproduce the reference mobile look via the shared StatusBadge.
 */
export const MOBILE_INVOICE_STATUS_VARIANTS: Record<InvoiceStatus, BadgeVariant> = {
  draft: 'neutral',
  issued: 'info',
  partially_paid: 'info',
  paid: 'success',
  overdue: 'warning',
  cancelled: 'danger',
  void: 'neutral',
};

/**
 * Payment status → BadgeVariant map for the MOBILE card list ONLY.
 *
 * Reference mobile payment list: COMPLETED green, PENDING gray,
 * REFUNDED violet, FAILED red. `violet` is the shared Badge variant added
 * for the REFUNDED pill (backward-compatible union extension).
 */
export const MOBILE_PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, BadgeVariant> = {
  pending: 'neutral',
  completed: 'success',
  failed: 'danger',
  refunded: 'violet',
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

/**
 * Server-side sort options for the list — only fields the backend whitelists
 * (`InvoiceRepository._ALLOWED_SORT_FIELDS`). `grand_total` is intentionally
 * absent: the repository silently falls back to the default sort for unknown
 * fields, so offering it would sort by the wrong column without any error.
 */
export const INVOICE_SORT_OPTIONS: readonly { value: InvoiceSortField; label: string }[] = [
  { value: 'created_at', label: 'Created date' },
  { value: 'invoice_number', label: 'Invoice number' },
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

/**
 * Line-item discount types (backend `InvoiceItemBase.discount_type`).
 *
 * The fixed-amount label uses the Billing INR presentation symbol (₹) — the
 * module never presents amounts in USD (see PAYMENT_CURRENCY_CODE).
 */
export const INVOICE_DISCOUNT_TYPE_OPTIONS: readonly {
  value: InvoiceDiscountType;
  label: string;
}[] = [
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
  { value: 'FIXED_AMOUNT', label: 'Fixed amount (₹)' },
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

/* ── Payment module list / form constants (Sprint 14A.3) ──────────── */

/**
 * Payment-module presentation currency (approved product requirement).
 *
 * Backend contract facts (verified against `app/modules/billing/`):
 * - `CurrencyCode` (enums.py) supports USD / EUR / GBP / INR — INR is a
 *   backend-supported ISO 4217 code.
 * - `PaymentCreateRequest` (schemas/payment.py) accepts NO currency field —
 *   the client never sends a currency.
 * - The payment model has no currency column; the mapper derives
 *   `currency_code` from the first allocation's invoice currency, falling
 *   back to `DEFAULT_CURRENCY` (USD) for unallocated payments.
 *
 * Because the backend does not pin payments to USD (it is only the
 * unallocated-payment fallback), the entire Billing frontend presents
 * amounts in INR per the approved product requirement, using the shared
 * `formatCurrency(value, PAYMENT_CURRENCY_CODE)` formatter (which already
 * maps INR → ₹). This covers the Payments module, the Billing Dashboard
 * (KPI totals, patient financial summary, recent invoices/payments) and the
 * Invoice module display surfaces (list, detail, line items, dialogs), so a
 * single payment or invoice reads identically everywhere in Billing. The
 * Invoice create form also defaults to this currency (new invoices are
 * recorded as currency_code=INR, which the backend CurrencyCode supports).
 * This constant is the single point of change for the Billing INR
 * presentation currency.
 */
export const PAYMENT_CURRENCY_CODE: CurrencyCode = 'INR';

/** Rupee glyph for the payment UI (matches the shared formatter's INR symbol). */
export const PAYMENT_CURRENCY_SYMBOL = '₹';

/** Default rows-per-page for GET /billing/payments (backend default 20). */
export const PAYMENT_LIST_PAGE_SIZE = 20;

/** Rows-per-page options (respects backend max page_size of 100). */
export const PAYMENT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Payment status options for the list Status filter (all backend enum values). */
export const PAYMENT_STATUS_OPTIONS: readonly { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'void', label: 'Void' },
];

/** Payment method options for the list Method filter (all backend enum values). */
export const PAYMENT_METHOD_OPTIONS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'wallet', label: 'Wallet' },
];

/** Server-side sort options (backend `PaymentRepository._SORT_FIELDS`). */
export const PAYMENT_SORT_OPTIONS: readonly { value: PaymentSortField; label: string }[] = [
  { value: 'created_at', label: 'Created date' },
  { value: 'payment_number', label: 'Payment number' },
  { value: 'payment_date', label: 'Payment date' },
  { value: 'total_amount', label: 'Total amount' },
  { value: 'status', label: 'Status' },
  { value: 'payment_method', label: 'Payment method' },
  { value: 'updated_at', label: 'Updated date' },
];

/* ── Payment field length limits mirrored from backend constants.py ─ */

/** `PAYMENT_NOTES_MAX_LENGTH` — payment notes max. */
export const PAYMENT_NOTES_MAX_LENGTH = 500;
/** `TRANSACTION_REFERENCE_MAX_LENGTH` — reference number max. */
export const PAYMENT_REFERENCE_MAX_LENGTH = 100;
/** `AUDIT_REASON_MAX_LENGTH` — fail/void/delete reason max. */
export const PAYMENT_REASON_MAX_LENGTH = 500;

/* ── Receipt presentation (backend `ReceiptStatus` enum) ──────────── */

/** Receipt status → BadgeVariant map. */
export const RECEIPT_STATUS_VARIANTS: Record<'generated' | 'cancelled', BadgeVariant> = {
  generated: 'success',
  cancelled: 'neutral',
};

/* ── Refund presentation (backend `RefundStatus` enum) ────────────── */

/**
 * Refund status → BadgeVariant map.
 *
 * pending → warning, approved → info (still needs completion),
 * rejected → danger (terminal), completed → success (terminal).
 */
export const REFUND_STATUS_VARIANTS: Record<'pending' | 'approved' | 'rejected' | 'completed', BadgeVariant> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  completed: 'success',
};

/** `RefundCreateRequest.reason` max length (backend schema — 1000). */
export const REFUND_REASON_MAX_LENGTH = 1000;
/** `RefundWorkflowRequest.reason` max length (backend schema — 500). */
export const REFUND_REJECTION_REASON_MAX_LENGTH = 500;

/* ═══════════════════════════════════════════════════════════════════
 * Sprint 14A.4 — Credit Note module
 * ═══════════════════════════════════════════════════════════════════ */

/** Credit note status → BadgeVariant map. */
export const CREDIT_NOTE_STATUS_VARIANTS: Record<CreditNoteStatus, BadgeVariant> = {
  draft: 'neutral',
  issued: 'info',
  applied: 'success',
  void: 'danger',
  expired: 'neutral',
};

/** Credit note reason max length (backend `CREDIT_NOTE_REASON_MAX_LENGTH`). */
export const CREDIT_NOTE_REASON_MAX_LENGTH = 500;

/** Credit note void reason max length (backend `VOID_REASON_MAX_LENGTH`). */
export const CREDIT_NOTE_VOID_REASON_MAX_LENGTH = 500;

