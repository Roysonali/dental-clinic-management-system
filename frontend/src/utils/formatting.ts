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
 * symbol, e.g. `formatFee(800, '₱')` → "₱800.00". Returns "—" for null,
 * undefined, empty strings, and any value that cannot be coerced to a
 * finite number (including the numeric strings the API may deliver, e.g.
 * `"800.00"`). Defensive by design: this shared helper is the last line of
 * defence for fee display, so it never throws on unexpected input.
 *
 * Shared by the Doctor table and details cards (single source of truth
 * for fee display; the symbol comes from the caller's module constants).
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
