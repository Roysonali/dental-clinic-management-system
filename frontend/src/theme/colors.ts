/**
 * DensCare Color Tokens
 * ======================
 *
 * Single source of truth for all colors used in the application.
 * These values mirror the CSS custom properties in `index.css`.
 *
 * Usage:
 *   import { colors } from '@/theme';
 *   <div style={{ color: colors.primary[500] }} />   // programmatic
 *   <div className="text-primary-500" />              // Tailwind (preferred)
 */

/* ── Brand / Primary ───────────────────────────────────────────────── */
export const primary = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
} as const;

/* ── Neutral / Slate ───────────────────────────────────────────────── */
export const neutral = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
} as const;

/* ── Semantic ──────────────────────────────────────────────────────── */
export const semantic = {
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  finalized: '#4f46e5',
  draft: '#6b7280',
} as const;

/* ── Status Badges ─────────────────────────────────────────────────── */
export const status = {
  active: '#059669',
  inactive: '#94a3b8',
  pending: '#d97706',
  draft: '#6b7280',
  progress: '#2563eb',
  completed: '#059669',
  cancelled: '#dc2626',
  hold: '#d97706',
  finalized: '#4f46e5',
} as const;

/**
 * Semantic alias mappings — maps abstract roles to concrete color tokens.
 * Useful for programmatic colour resolution in components.
 *
 * Example:
 *   const btnBg = colorByRole('primary');  // → '#3b82f6'
 *   const alertBg = colorByRole('danger'); // → '#dc2626'
 */
export const colorByRole = {
  primary: primary[500],
  secondary: neutral[600],
  success: semantic.success,
  warning: semantic.warning,
  danger: semantic.danger,
  info: semantic.info,
  draft: semantic.draft,
  finalized: semantic.finalized,
  muted: neutral[400],
  background: neutral[50],
  foreground: neutral[800],
  border: neutral[200],
} as const;

/**
 * Complete color palette — flat object for easy consumption.
 */
export const colors = {
  primary,
  neutral,
  semantic,
  status,
  ...colorByRole,
  /** RGB channels for opacity calculations (e.g. `rgba(${colors.channels.primary[500]}, 0.5)`) */
  channels: {
    primary: {
      50: '239,246,255',
      100: '219,234,254',
      200: '191,219,254',
      400: '96,165,250',
      500: '59,130,246',
      600: '37,99,235',
      700: '29,78,216',
    },
    neutral: {
      50: '248,250,252',
      100: '241,245,249',
      200: '226,232,240',
      300: '203,213,225',
      400: '148,163,184',
      500: '100,116,139',
      600: '71,85,105',
      700: '51,65,85',
      800: '30,41,59',
      900: '15,23,42',
    },
    success: '5,150,105',
    warning: '217,119,6',
    danger: '220,38,38',
    info: '37,99,235',
  } as const,
} as const;

export type ColorRole = keyof typeof colorByRole;
export type PrimaryScale = keyof typeof primary;
export type NeutralScale = keyof typeof neutral;
