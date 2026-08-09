/**
 * Refund formatting helpers (Sprint 14A.5).
 *
 * Single source of truth for refund currency/date display. Amounts use the
 * Billing-wide INR presentation currency (`PAYMENT_CURRENCY_CODE`) via the
 * shared `formatCurrency` (which maps INR → ₹); the backend stays the
 * financial authority.
 */

import { formatCurrency } from './formatting';
import { PAYMENT_CURRENCY_CODE } from '../constants/billing';

/** Format a refund monetary value in the Billing presentation currency. */
export function formatRefundAmount(
  value: number | string | null | undefined,
  currencyCode: string = PAYMENT_CURRENCY_CODE,
): string {
  return formatCurrency(value, currencyCode);
}

/** Build "DD Mon YYYY" (e.g. "09 Jul 2026") from a Date. */
function dayMonthYear(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${month} ${date.getFullYear()}`;
}

/** Format an ISO date (YYYY-MM-DD) as e.g. "09 Jul 2026". Returns "—" when empty. */
export function formatRefundDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return dayMonthYear(date);
}

/** Format an ISO datetime as e.g. "09 Jul 2026, 14:20". Returns "—" when empty. */
export function formatRefundDateTime(datetimeStr: string | null | undefined): string {
  if (!datetimeStr) return '—';
  const date = new Date(datetimeStr);
  if (Number.isNaN(date.getTime())) return datetimeStr;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dayMonthYear(date)}, ${hours}:${minutes}`;
}
