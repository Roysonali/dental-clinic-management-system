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
