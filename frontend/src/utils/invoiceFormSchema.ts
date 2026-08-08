/**
 * Zod schemas for the Invoice module forms (Sprint 14A.2).
 *
 * Mirrors backend bounds EXACTLY (backend remains authoritative — these are
 * UX-grade previews):
 * - `InvoiceCreateRequest` (schemas/invoice.py): patient_id required;
 *   invoice_date + due_date required; due_date >= invoice_date; currency 3
 *   chars; notes <= 2000; items >= 1.
 * - `InvoiceItemCreate` (schemas/invoice_item.py): description 1–500;
 *   quantity >= 1; unit_price >= 0; discount_value non-negative and
 *   <= line subtotal (service `_compute_item_net_amount` floors net at 0).
 * - `InvoiceDraftUpdateRequest`: only notes + due_date are updatable.
 */
import { z } from 'zod';
import {
  INVOICE_CANCEL_REASON_MAX_LENGTH,
  INVOICE_ITEM_DESCRIPTION_MAX_LENGTH,
  INVOICE_MIN_ITEM_QUANTITY,
  INVOICE_MIN_LINE_ITEMS,
  INVOICE_NOTES_MAX_LENGTH,
} from '../constants/billing';
import type {
  InvoiceDiscountType,
} from '../types/billing';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ERROR = 'Enter a valid date (YYYY-MM-DD)';

/** Parse a money input ("", "10", "10.5") → finite number or NaN. */
export function parseMoney(value: string): number {
  if (value === undefined || value === null) return Number.NaN;
  const trimmed = String(value).trim();
  if (trimmed === '') return 0;
  return Number(trimmed);
}

export type DiscountTypeField = '' | InvoiceDiscountType;

export interface InvoiceLineItemFormValues {
  description: string;
  /** Whole-number string (DOM value) — converted to number in formUtils. */
  quantity: string;
  unit_price: string;
  discount_type: DiscountTypeField;
  discount_value: string;
}

/** Positive-whole-number pattern for the quantity string. */
const QUANTITY_PATTERN = /^\d+$/;

const lineItemSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, 'Description is required')
      .max(INVOICE_ITEM_DESCRIPTION_MAX_LENGTH, `Description must be at most ${INVOICE_ITEM_DESCRIPTION_MAX_LENGTH} characters`),
    quantity: z
      .string()
      .trim()
      .refine((v) => QUANTITY_PATTERN.test(v), 'Quantity must be a whole number')
      .refine((v) => Number(v) >= INVOICE_MIN_ITEM_QUANTITY, `Quantity must be at least ${INVOICE_MIN_ITEM_QUANTITY}`),
    unit_price: z
      .string()
      .trim()
      .refine((v) => !Number.isNaN(parseMoney(v)) && parseMoney(v) >= 0, {
        message: 'Unit price must be 0 or more',
      }),
    discount_type: z.union([
      z.literal(''),
      z.literal('PERCENTAGE'),
      z.literal('FIXED_AMOUNT'),
    ]),
    discount_value: z.string().trim(),
  })
  .superRefine((item, ctx) => {
    if (item.discount_type === '') return;
    const discount = parseMoney(item.discount_value);
    if (Number.isNaN(discount) || discount < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount_value'],
        message: 'Discount must be 0 or more',
      });
      return;
    }
    const unitPrice = parseMoney(item.unit_price);
    const quantity = Number(item.quantity);
    const subtotal = Number.isFinite(unitPrice) ? unitPrice * (Number.isFinite(quantity) ? quantity : 0) : 0;
    // The backend rejects a discount that exceeds the line subtotal
    // (`_validate_and_attach_items` → InvoiceValidationFailed).
    if (discount > subtotal) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount_value'],
        message: 'Discount cannot exceed the line subtotal',
      });
    }
  });

export interface InvoiceCreateFormValues {
  patient_id: string;
  treatment_plan_id: string;
  appointment_id: string;
  doctor_id: string;
  currency_code: string;
  invoice_date: string;
  due_date: string;
  notes: string;
  items: InvoiceLineItemFormValues[];
}

export const invoiceCreateFormSchema = z
  .object({
    patient_id: z.string().min(1, 'Select a patient to bill'),
    treatment_plan_id: z.string(),
    appointment_id: z.string(),
    doctor_id: z.string(),
    currency_code: z.string().min(3).max(3),
    invoice_date: z.string().refine((v) => DATE_PATTERN.test(v), {
      message: DATE_ERROR,
    }),
    due_date: z.string().refine((v) => DATE_PATTERN.test(v), {
      message: DATE_ERROR,
    }),
    notes: z
      .string()
      .refine((v) => v.length <= INVOICE_NOTES_MAX_LENGTH, {
        message: `Notes must be at most ${INVOICE_NOTES_MAX_LENGTH} characters`,
      }),
    items: z
      .array(lineItemSchema)
      .min(INVOICE_MIN_LINE_ITEMS, 'Add at least one line item'),
  })
  .superRefine((values, ctx) => {
    // Backend `validate_due_date` / `validate_invoice_date`: due >= invoice.
    if (
      values.invoice_date &&
      values.due_date &&
      values.due_date < values.invoice_date
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['due_date'],
        message: 'Due date cannot be before the invoice date',
      });
    }
  });

export type InvoiceCreateFormValuesForZod = InvoiceCreateFormValues;

/** Edit-draft form: backend PATCH only accepts notes + due_date. */
export interface InvoiceEditFormValues {
  due_date: string;
  notes: string;
}

export const invoiceEditFormSchema = z
  .object({
    due_date: z.string().refine((v) => DATE_PATTERN.test(v), {
      message: DATE_ERROR,
    }),
    notes: z
      .string()
      .refine((v) => v.length <= INVOICE_NOTES_MAX_LENGTH, {
        message: `Notes must be at most ${INVOICE_NOTES_MAX_LENGTH} characters`,
      }),
  });

/** Cancel-reason field schema — backend requires 1–500 chars. */
export const invoiceCancelReasonSchema = z
  .string()
  .trim()
  .min(1, 'A cancellation reason is required')
  .max(
    INVOICE_CANCEL_REASON_MAX_LENGTH,
    `Reason must be at most ${INVOICE_CANCEL_REASON_MAX_LENGTH} characters`,
  );

/** Cancel-invoice form schema (single required field). */
export const invoiceCancelFormSchema = z.object({
  cancellation_reason: invoiceCancelReasonSchema,
});

export type InvoiceCancelFormValues = { cancellation_reason: string };
