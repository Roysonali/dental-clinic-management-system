/**
 * Invoice form conversion utilities (Sprint 14A.2).
 *
 * Converts react-hook-form values into the exact backend request payloads and
 * back (edit prefill). The line net amount mirrors the backend rule
 * (`invoice_service._compute_item_net_amount`):
 *
 *     net = max(0, unit_price * quantity - discount_value)
 *
 * This is a UX PREVIEW only — the backend recomputes and remains the
 * financial authority.
 */
import { addDaysISO, todayLocalISO } from './date';
import {
  INVOICE_ITEM_DESCRIPTION_MAX_LENGTH,
  PAYMENT_CURRENCY_CODE,
} from '../constants/billing';
import type {
  InvoiceCreatePayload,
  InvoiceDraftUpdatePayload,
  InvoiceItemCreatePayload,
  InvoiceRead,
} from '../types/billing';
import {
  parseMoney,
  type InvoiceCreateFormValues,
  type InvoiceEditFormValues,
  type InvoiceLineItemFormValues,
} from './invoiceFormSchema';

/** Round a computed net amount to 2 decimals (backend quantizes to NUMERIC(12,2)). */
export function quantizeMoney(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return Math.max(0, value).toFixed(2);
}

/**
 * Compute the line net amount exactly as the backend does:
 * `max(0, unit_price * quantity - discount_value)`.
 */
export function computeLineNetAmount(
  unitPrice: string,
  quantity: string | number,
  discountValue: string,
): string {
  const price = parseMoney(unitPrice);
  const qty = typeof quantity === 'number' ? quantity : Number(quantity);
  const discount = parseMoney(discountValue);
  const subtotal = Number.isFinite(price) ? price * (Number.isFinite(qty) ? qty : 0) : 0;
  return quantizeMoney(subtotal - discount);
}

/** Default (empty) line item row for the create drawer. */
export function emptyLineItemFormValue(): InvoiceLineItemFormValues {
  return {
    description: '',
    quantity: '1',
    unit_price: '',
    discount_type: '',
    discount_value: '',
  };
}

/** Default values for the create-invoice form. */
export function defaultCreateInvoiceValues(): InvoiceCreateFormValues {
  const invoiceDate = todayLocalISO();
  return {
    patient_id: '',
    treatment_plan_id: '',
    appointment_id: '',
    doctor_id: '',
    // The clinic presents (and now records) billing in INR — the approved
    // product currency. The backend CurrencyCode supports INR, so the
    // create payload is sent as currency_code=INR.
    currency_code: PAYMENT_CURRENCY_CODE,
    invoice_date: invoiceDate,
    // The backend create schema REQUIRES due_date; its service documents the
    // default as invoice_date + 30 days, so the form prefills that default.
    due_date: addDaysISO(invoiceDate, 30),
    notes: '',
    items: [emptyLineItemFormValue()],
  };
}

/** Prefill for the edit-draft form (backend only exposes notes + due_date). */
export function invoiceToEditFormValues(invoice: InvoiceRead): InvoiceEditFormValues {
  return {
    due_date: invoice.due_date,
    notes: invoice.notes ?? '',
  };
}

/** Convert a line item row into the backend create payload shape. */
export function lineItemFormValuesToPayload(
  item: InvoiceLineItemFormValues,
  sequenceNumber: number,
): InvoiceItemCreatePayload {
  const discountValue = item.discount_type === '' ? '' : item.discount_value;
  return {
    description: item.description.trim().slice(0, INVOICE_ITEM_DESCRIPTION_MAX_LENGTH),
    quantity: Number(item.quantity),
    unit_price: quantizeMoney(parseMoney(item.unit_price)),
    discount_type: item.discount_type === '' ? null : item.discount_type,
    discount_value: discountValue.trim() === '' ? null : quantizeMoney(parseMoney(discountValue)),
    net_amount: computeLineNetAmount(item.unit_price, item.quantity, discountValue),
    sequence_number: sequenceNumber,
  };
}

/** Convert the full create form into POST /billing/invoices payload. */
export function invoiceFormValuesToCreatePayload(
  values: InvoiceCreateFormValues,
): InvoiceCreatePayload {
  const payload: InvoiceCreatePayload = {
    patient_id: values.patient_id,
    invoice_date: values.invoice_date,
    due_date: values.due_date,
    currency_code: values.currency_code,
    items: values.items.map((item, index) =>
      lineItemFormValuesToPayload(item, index + 1),
    ),
  };
  if (values.treatment_plan_id) payload.treatment_plan_id = values.treatment_plan_id;
  if (values.appointment_id) payload.appointment_id = values.appointment_id;
  if (values.doctor_id) payload.doctor_id = values.doctor_id;
  if (values.notes.trim()) payload.notes = values.notes.trim();
  return payload;
}

/** Convert the edit-draft form into PATCH /billing/invoices/{id} payload. */
export function editFormValuesToUpdatePayload(
  values: InvoiceEditFormValues,
): InvoiceDraftUpdatePayload {
  return {
    due_date: values.due_date,
    notes: values.notes.trim() === '' ? null : values.notes.trim(),
  };
}

/** Compute the sum of line net amounts for the drawer's running total preview. */
export function previewGrandTotal(items: InvoiceLineItemFormValues[]): string {
  const total = items.reduce((sum, item) => {
    const net = parseMoney(computeLineNetAmount(item.unit_price, item.quantity, item.discount_value));
    return sum + (Number.isFinite(net) ? net : 0);
  }, 0);
  return quantizeMoney(total);
}
