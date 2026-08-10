/**
 * Credit Note formatting helpers (Sprint 14A.4).
 *
 * Shared helpers for credit note display — single source of truth for
 * currency formatting, number display, and audit trail timestamps.
 */

import { formatCurrency } from './formatting';

/**
 * Format a credit note number for display (CN- prefix is already part of the number).
 */
export function formatCreditNoteNumber(number: string | null | undefined): string {
  if (!number) return '—';
  return number;
}

/**
 * Format an amount for the credit note financial summary.
 */
export function formatCreditNoteAmount(
  value: number | string | null | undefined,
  currencyCode = 'INR',
): string {
  return formatCurrency(value, currencyCode);
}

/**
 * Format a date string (YYYY-MM-DD) to a display format.
 */
export function formatCreditNoteDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a datetime string to a display format.
 */
export function formatCreditNoteDateTime(datetimeStr: string | null | undefined): string {
  if (!datetimeStr) return '—';
  const date = new Date(datetimeStr);
  if (Number.isNaN(date.getTime())) return datetimeStr;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
