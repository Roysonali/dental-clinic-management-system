/**
 * DensCare Border Radius Tokens
 * ==============================
 *
 * Usage:
 *   className="rounded-lg"          // Tailwind (preferred)
 *   style={{ borderRadius: radius.lg }} // programmatic
 */

export const radius = {
  none: '0px',
  xs: '0.125rem',    // 2px
  sm: '0.25rem',     // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  full: '9999px',    // pill / circular
} as const;

export type RadiusToken = keyof typeof radius;
