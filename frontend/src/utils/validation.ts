/**
 * Validation utility functions.
 *
 * Reusable helpers for form validation that can be shared
 * across modules.
 */

/** Check if a string is a valid email address */
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/** Check password strength and return a score (0–6) */
export const getPasswordScore = (password: string): number => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return score;
};

/** Check if a value is non-empty */
export const isNonEmpty = (value: string): boolean =>
  value.trim().length > 0;
