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
