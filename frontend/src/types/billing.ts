/**
 * Billing module types.
 *
 * Strictly mirrors backend `app/modules/billing/schemas/`:
 * - dashboard.py  → BillingDashboardResponse, BillingTotalsResponse,
 *                   PatientFinancialSummaryResponse
 * - invoice.py    → InvoiceListItem, InvoiceFinancialSummary
 * - payment.py    → PaymentListItem, PaymentFinancialSummary
 * - summaries.py  → PatientSummary
 * - enums.py      → InvoiceStatus, PaymentStatus, PaymentMethod, CurrencyCode
 *
 * All monetary values are quantized `Decimal` strings (e.g. "15000.00") —
 * pydantic v2 serializes Decimal as `str` in JSON mode, and the backend
 * dashboard schemas explicitly document "quantized Decimal strings".
 * Do NOT invent fields, enums, or calculations that don't exist upstream.
 */

/** Backend `InvoiceStatus` enum (enums.py). */
export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'void';

/** Backend `PaymentStatus` enum (enums.py). */
export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'reversed'
  | 'void';

/** Backend `PaymentMethod` enum (enums.py). */
export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'upi'
  | 'bank_transfer'
  | 'cheque'
  | 'insurance'
  | 'wallet';

/** Backend `CurrencyCode` enum (enums.py) — the codes the billing module supports. */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR';

/** Quantized money value as delivered by the backend (Decimal → string). */
export type Money = string;

/** `PatientSummary` (schemas/summaries.py) — nested in invoice/payment rows. */
export interface BillingPatientSummary {
  id: string;
  /** e.g. PAT-000001 */
  patient_code: string;
  /** Computed patient full name. */
  full_name: string;
  is_active: boolean;
}

/** `DoctorSummary` (schemas/invoice.py) — nested, nullable on invoice rows. */
export interface BillingDoctorSummary {
  id: string;
  doctor_code: string;
  user_full_name: string | null;
  is_active: boolean;
}

/** `InvoiceFinancialSummary` (schemas/invoice.py). */
export interface InvoiceFinancialSummary {
  currency_code: string;
  subtotal: Money;
  discount_total: Money;
  tax_total: Money;
  grand_total: Money;
  paid_amount: Money;
  outstanding_amount: Money;
}

/** `InvoiceListItem` (schemas/invoice.py) — used in `recent_invoices`. */
export interface InvoiceListItem {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  patient: BillingPatientSummary;
  doctor: BillingDoctorSummary | null;
  invoice_date: string;
  due_date: string;
  financials: InvoiceFinancialSummary;
  item_count: number;
  created_at: string;
}

/** `PaymentFinancialSummary` (schemas/payment.py). */
export interface PaymentFinancialSummary {
  currency_code: string;
  total_amount: Money;
  allocated_amount: Money;
  refunded_amount: Money;
  unallocated_amount: Money;
}

/** `PaymentListItem` (schemas/payment.py) — used in `recent_payments`. */
export interface PaymentListItem {
  id: string;
  payment_number: string;
  status: PaymentStatus;
  patient: BillingPatientSummary;
  payment_method: PaymentMethod;
  total_amount: Money;
  payment_date: string;
  financials: PaymentFinancialSummary;
  allocation_count: number;
  created_at: string;
}

/** `BillingTotalsResponse` (schemas/dashboard.py) — system-wide totals. */
export interface BillingTotals {
  total_invoiced: Money;
  total_collected: Money;
  total_refunded: Money;
  total_outstanding: Money;
  total_credited: Money;
  invoice_count: number;
  paid_invoice_count: number;
  outstanding_invoice_count: number;
  payment_count: number;
  credit_note_count: number;
}

/** `PatientFinancialSummaryResponse` (schemas/dashboard.py). */
export interface PatientFinancialSummary {
  patient_id: string;
  total_invoiced: Money;
  /** Non-refund payment allocations (shown as "Collected" in the UI). */
  total_paid: Money;
  total_refunded: Money;
  total_outstanding: Money;
  total_credited: Money;
  total_credit_remaining: Money;
  invoice_count: number;
  paid_invoice_count: number;
  outstanding_invoice_count: number;
  payment_count: number;
  credit_note_count: number;
}

/** `BillingDashboardResponse` (schemas/dashboard.py) — GET /billing/dashboard. */
export interface BillingDashboardResponse {
  totals: BillingTotals;
  /** Most recently created invoices (up to 5). */
  recent_invoices: InvoiceListItem[];
  /** Most recently created payments (up to 5). */
  recent_payments: PaymentListItem[];
  /** Patient-level financial summary when a `patient_id` filter is applied. */
  patient_summary: PatientFinancialSummary | null;
  generated_at: string;
}

/* ═══════════════════════════════════════════════════════════════════
 * Sprint 14A.2 — Invoice module (list / detail / lifecycle)
 *
 * Mirrors backend `schemas/invoice.py`, `schemas/invoice_item.py` and the
 * router query params (`routers/invoice.py`). Monetary fields are quantized
 * Decimal strings. Do NOT invent fields beyond the upstream contract.
 * ═══════════════════════════════════════════════════════════════════ */

/** Sort direction accepted by GET /billing/invoices (`sort_order`). */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort fields the backend actually supports.
 *
 * Matches the invoice repository `_ALLOWED_SORT_FIELDS` whitelist
 * (invoice_repository.py): created_at, updated_at, invoice_number,
 * due_date, status. NOTE: `grand_total` is deliberately NOT included — the
 * backend resolves unknown sort fields silently to the default (created_at),
 * so offering it would silently sort by the wrong column.
 */
export type InvoiceSortField =
  | 'created_at'
  | 'updated_at'
  | 'invoice_number'
  | 'status'
  | 'due_date';

/** Query params for GET /billing/invoices (all server-side). */
export interface InvoiceListParams {
  page: number;
  page_size: number;
  sort_by: InvoiceSortField;
  sort_order: SortOrder;
  /** Free-text search across invoice number and patient name. */
  query?: string;
  patient_id?: string;
  doctor_id?: string;
  /** Backend `InvoiceStatus` exact-match filter. */
  status?: InvoiceStatus;
  /** Filter invoices with invoice_date on/after this date (YYYY-MM-DD). */
  date_from?: string;
  /** Filter invoices with invoice_date on/before this date (YYYY-MM-DD). */
  date_to?: string;
}

/** `InvoiceListResponse` (schemas/invoice.py) — GET /billing/invoices. */
export interface InvoiceListResponse {
  items: InvoiceListItem[];
  total: number;
  page: number;
  page_size: number;
}

/** `TreatmentPlanSummary` (schemas/invoice.py) — nested on invoice detail. */
export interface BillingTreatmentPlanSummary {
  id: string;
  /** e.g. TXN-000003 */
  plan_code: string;
  status: string;
}

/** `AppointmentSummary` (schemas/invoice.py) — nested on invoice detail. */
export interface BillingAppointmentSummary {
  id: string;
  /** e.g. APT-20260727-0003 */
  appointment_number: string;
  appointment_date: string;
}

/** `CreatorSummary` (schemas/summaries.py) — audit trail on invoice detail. */
export interface BillingCreatorSummary {
  id: number;
  full_name: string | null;
}

/** `InvoiceItemSummary` (schemas/invoice_item.py) — line items on invoice. */
export interface InvoiceItemSummary {
  id: string;
  sequence_number: number;
  description: string;
  quantity: number;
  unit_price: Money;
  discount_type: string | null;
  discount_value: Money | null;
  net_amount: Money;
  tax_amount: Money | null;
  currency_code: string;
}

/** `InvoiceRead` (schemas/invoice.py) — GET /billing/invoices/{id}. */
export interface InvoiceRead {
  id: string;
  invoice_number: string;
  document_type: string;
  status: InvoiceStatus;
  patient: BillingPatientSummary;
  doctor: BillingDoctorSummary | null;
  treatment_plan: BillingTreatmentPlanSummary | null;
  appointment: BillingAppointmentSummary | null;
  creator: BillingCreatorSummary | null;
  updater: BillingCreatorSummary | null;
  invoice_date: string;
  due_date: string;
  currency_code: string;
  notes: string | null;
  cancellation_reason: string | null;
  void_reason: string | null;
  items: InvoiceItemSummary[];
  financials: InvoiceFinancialSummary;
  version: number;
  doc_version: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number | null;
}

/** Discount kinds accepted by the backend (`discount_type` on items). */
export type InvoiceDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

/** A line item as submitted to POST /billing/invoices. */
export interface InvoiceItemCreatePayload {
  description: string;
  quantity: number;
  unit_price: Money;
  discount_type: InvoiceDiscountType | null;
  discount_value: Money | null;
  net_amount: Money;
  sequence_number: number;
  plan_item_id?: string;
  diagnosis_id?: string;
  original_price?: Money;
  override_reason?: string;
}

/** Body for POST /billing/invoices (`InvoiceCreateRequest`). */
export interface InvoiceCreatePayload {
  patient_id: string;
  treatment_plan_id?: string;
  appointment_id?: string;
  doctor_id?: string;
  invoice_date: string;
  due_date: string;
  currency_code: string;
  notes?: string;
  items: InvoiceItemCreatePayload[];
}

/** Body for PATCH /billing/invoices/{id} (`InvoiceDraftUpdateRequest`). */
export interface InvoiceDraftUpdatePayload {
  notes: string | null;
  due_date?: string;
}

/** Body for POST /billing/invoices/{id}/cancel. */
export interface CancelInvoicePayload {
  cancellation_reason: string;
}

/* ═══════════════════════════════════════════════════════════════════
 * Sprint 14A.3 — Payment module (list / detail / lifecycle / allocation)
 *
 * Mirrors backend `schemas/payment.py`, `schemas/receipt.py` and the router
 * query params (`routers/payment.py`, `routers/receipt.py`). Monetary fields
 * are quantized Decimal strings. Do NOT invent fields beyond the upstream
 * contract.
 * ═══════════════════════════════════════════════════════════════════ */

/** Sort fields the backend allows for GET /billing/payments (`PaymentRepository._SORT_FIELDS`). */
export type PaymentSortField =
  | 'created_at'
  | 'updated_at'
  | 'payment_number'
  | 'payment_date'
  | 'total_amount'
  | 'status'
  | 'payment_method';

/** Query params for GET /billing/payments (all server-side). */
export interface PaymentListParams {
  page: number;
  page_size: number;
  sort_by: PaymentSortField;
  sort_order: SortOrder;
  patient_id?: string;
  /** Backend `PaymentMethod` exact-match filter. */
  payment_method?: PaymentMethod;
  /** Backend `PaymentStatus` exact-match filter. */
  status?: PaymentStatus;
  /** Filter payments with payment_date on/after this date (YYYY-MM-DD). */
  date_from?: string;
  /** Filter payments with payment_date on/before this date (YYYY-MM-DD). */
  date_to?: string;
}

/** `PaymentListResponse` (schemas/payment.py) — GET /billing/payments. */
export interface PaymentListResponse {
  items: PaymentListItem[];
  total: number;
  page: number;
  page_size: number;
}

/** `PaymentGatewayMetadata` (schemas/payment.py) — nullable on detail. */
export interface PaymentGatewayMetadata {
  gateway_txn_id: string | null;
  gateway_order_id: string | null;
  bank_reference_number: string | null;
  payment_source: string | null;
}

/** `InvoiceSummary` (schemas/payment.py) — embedded in allocation summaries. */
export interface PaymentInvoiceSummary {
  id: string;
  invoice_number: string;
  patient: BillingPatientSummary;
  invoice_date: string;
  currency_code: string;
  grand_total: Money;
}

/** `PaymentAllocationSummary` (schemas/payment.py) — payment↔invoice link. */
export interface PaymentAllocationSummary {
  id: string;
  /** Null for advance/unallocated payments or refunds. */
  invoice: PaymentInvoiceSummary | null;
  allocated_amount: Money;
  is_refund: boolean;
  created_at: string;
}

/** `PaymentRead` (schemas/payment.py) — GET /billing/payments/{id}. */
export interface PaymentRead {
  id: string;
  payment_number: string;
  document_type: string;
  status: PaymentStatus;
  patient: BillingPatientSummary;
  creator: BillingCreatorSummary | null;
  updater: BillingCreatorSummary | null;
  payment_method: PaymentMethod;
  total_amount: Money;
  payment_date: string;
  currency_code: string;
  reference_number: string | null;
  is_reversed: boolean;
  reversal_reason: string | null;
  notes: string | null;
  allocations: PaymentAllocationSummary[];
  financials: PaymentFinancialSummary;
  gateway_metadata: PaymentGatewayMetadata | null;
  version: number;
  doc_version: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number | null;
}

/** Body for POST /billing/payments (`PaymentCreateRequest`). */
export interface PaymentCreatePayload {
  patient_id: string;
  payment_method: PaymentMethod;
  total_amount: Money;
  payment_date: string;
  reference_number?: string | null;
  notes?: string | null;
}

/** Body for PATCH /billing/payments/{id} (`PaymentMetadataUpdateRequest`). */
export interface PaymentMetadataUpdatePayload {
  reference_number?: string | null;
  notes?: string | null;
}

/** Body for POST /billing/payments/{id}/fail and /void (reason optional). */
export interface PaymentStatusChangePayload {
  reason?: string;
}

/** Body for POST /billing/payments/{id}/allocate (`PaymentAllocateRequest`). */
export interface PaymentAllocatePayload {
  invoice_id: string;
  amount: Money;
}

/** Body for POST /billing/payments/{id}/deallocate (`PaymentDeallocateRequest`). */
export interface PaymentDeallocatePayload {
  invoice_id: string;
}

/** `ReceiptPaymentSummary` (schemas/receipt.py) — embedded on receipts. */
export interface ReceiptPaymentSummary {
  id: string;
  payment_number: string;
  payment_method: string;
  total_amount: Money;
  payment_date: string;
  currency_code: string;
}

/**
 * `ReceiptRead` (schemas/receipt.py) — the subset surfaced by the Payment
 * detail's Receipt card (POST /billing/receipts returns the full aggregate).
 */
export interface ReceiptRead {
  id: string;
  receipt_number: string;
  status: 'generated' | 'cancelled';
  amount: Money;
  currency_code: string;
  receipt_date: string;
  payment: ReceiptPaymentSummary;
  created_at: string;
}

/** Body for POST /billing/receipts (`ReceiptGenerateRequest`). */
export interface ReceiptGeneratePayload {
  payment_id: string;
}
