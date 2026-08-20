/**
 * Formatting utility functions.
 *
 * Reusable helpers for formatting dates, currency, names, etc.
 */

/** Format a full name from first and last parts */
export const formatFullName = (
  firstName: string,
  lastName?: string,
): string => {
  return lastName ? `${firstName} ${lastName}`.trim() : firstName.trim();
};

/** Truncate a string to a maximum length with ellipsis */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
};

/** Format a phone number for display (basic) */
export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

/** Capitalize the first letter of a string */
export const capitalize = (text: string): string => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Derive up-to-two initials from a full name (e.g. "Dr. Jose Rizal" → "JR").
 *
 * Shared by every avatar in the app (UserSearchSelect, UserTable,
 * DoctorAvatar, UserHeader) — single source of truth for initials.
 */
export const getInitials = (fullName: string | null | undefined): string => {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Format a monetary amount with two decimals and the given currency
 * symbol, e.g. `formatFee(800, '₹')` → "₹800.00". Returns "—" for null,
 * undefined, empty strings, and any value that cannot be coerced to a
 * finite number (including the numeric strings the API may deliver, e.g.
 * `"800.00"`). Defensive by design: this shared helper is the last line of
 * defence for fee display, so it never throws on unexpected input.
 *
 * Symbol-based helper retained for generic use. Module fee displays now
 * prefer `formatCurrency(value, code)` (code → symbol mapping with
 * thousands grouping); callers of `formatFee` pass their own symbol.
 */
export const formatFee = (
  value: number | string | null | undefined,
  symbol: string,
): string => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${symbol}${numeric.toFixed(2)}`;
};

/**
 * Currency-code → symbol mapping for the billing module's supported
 * currencies (mirrors the backend `CurrencyCode` enum in
 * `app/modules/billing/enums.py`). Unknown codes fall back to a code-prefixed
 * display (e.g. `"XYZ 100.00"`) rather than rendering an empty prefix.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

/**
 * Format a monetary amount with two decimals, thousands grouping, and the
 * symbol for the given ISO currency code, e.g. `formatCurrency('4210.00', 'INR')`
 * → "₹4,210.00". Returns "—" for null, undefined, empty strings, and any
 * value that cannot be coerced to a finite number (numeric strings such as
 * the backend's quantized Decimal wire format `"15000.00"` are supported).
 *
 * Single shared currency formatter for the Billing module (financial data
 * presentation rules: right-aligned, grouped, 2-dp precision, no ambiguous
 * signs). Defaults to INR — the Billing presentation currency
 * (`PAYMENT_CURRENCY_CODE`, the single point of change for Billing INR
 * display) — so an omitted code can never render an off-currency amount
 * (aggregated totals like `BillingTotalsResponse` carry no currency code of
 * their own). The backend's other supported codes (USD/EUR/GBP) remain
 * formattable when passed explicitly.
 *
 * Uses the explicit `en-US` locale so grouping/symbol output is
 * deterministic across environments (an enterprise financial UI must not
 * flip formatting with the runtime locale).
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currencyCode = 'INR',
): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '—';
  const grouped = numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = CURRENCY_SYMBOLS[currencyCode];
  return symbol ? `${symbol}${grouped}` : `${currencyCode} ${grouped}`;
}

/**
 * Format a count with thousands grouping, e.g. `formatCount(1234)` → "1,234".
 * Returns "—" for null or undefined. Used for count KPIs (paid invoices,
 * payments, credit notes, etc.).
 */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('en-US');
}
