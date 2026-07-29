/**
 * DensCare Typography Tokens
 * ===========================
 *
 * Centralised type scale for the entire application.
 * Values mirror the `@theme` declarations in `index.css`.
 *
 * Usage:
 *   import { typography } from '@/theme';
 *   className="text-display font-semibold"    // Tailwind (preferred)
 *   className={typography.size.display}        // fallback / programmatic
 */

/* ── Font Family ───────────────────────────────────────────────────── */
export const fontFamily = '"Inter", ui-sans-serif, system-ui, sans-serif';

/* ── Monospace Family ──────────────────────────────────────────────── */
export const fontMono = '"JetBrains Mono", "Fira Code", ui-monospace, monospace';

/* ── Type Scale ────────────────────────────────────────────────────── */

/** Each token defines size, lineHeight, weight, and letterSpacing. */
export const typeScale = {
  display: {
    size: '1.875rem',      // 30px
    lineHeight: '1.3',
    weight: '600',
    letterSpacing: '-0.025em',
  },
  h1: {
    size: '1.5rem',        // 24px
    lineHeight: '1.3',
    weight: '600',
    letterSpacing: '-0.02em',
  },
  h2: {
    size: '1.25rem',       // 20px
    lineHeight: '1.4',
    weight: '600',
    letterSpacing: '-0.015em',
  },
  h3: {
    size: '1.125rem',      // 18px
    lineHeight: '1.4',
    weight: '600',
    letterSpacing: '-0.01em',
  },
  h4: {
    size: '1rem',          // 16px
    lineHeight: '1.5',
    weight: '600',
    letterSpacing: '0',
  },
  body: {
    size: '0.875rem',      // 14px
    lineHeight: '1.5',
    weight: '400',
    letterSpacing: '0',
  },
  'body-sm': {
    size: '0.8125rem',     // 13px
    lineHeight: '1.5',
    weight: '400',
    letterSpacing: '0',
  },
  caption: {
    size: '0.75rem',       // 12px
    lineHeight: '1.5',
    weight: '400',
    letterSpacing: '0.005em',
  },
  label: {
    size: '0.8125rem',     // 13px
    lineHeight: '1.5',
    weight: '500',
    letterSpacing: '0.01em',
  },
  button: {
    size: '0.875rem',      // 14px
    lineHeight: '1',
    weight: '500',
    letterSpacing: '0.01em',
  },
  'button-sm': {
    size: '0.8125rem',     // 13px
    lineHeight: '1',
    weight: '500',
    letterSpacing: '0.01em',
  },
  /**
   * Code/inline-code typography.
   * Note: Tailwind v4 does NOT apply fontFamily from fontSize sub-properties.
   * Pair with `font-mono` class: `className="text-code font-mono"`.
   */
  code: {
    size: '0.8125rem',     // 13px
    lineHeight: '1.5',
    weight: '400',
    letterSpacing: '0',
  },
  monospace: {
    size: '0.8125rem',     // 13px
    lineHeight: '1.5',
    weight: '400',
    letterSpacing: '0',
  },
  small: {
    size: '0.6875rem',     // 11px
    lineHeight: '1.4',
    weight: '400',
    letterSpacing: '0.01em',
  },
} as const;

export type TypeLevel = keyof typeof typeScale;

/* ── Font Weights (convenience constants) ──────────────────────────── */
export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/* ── Convenience: flat typography object (backward-compatible) ─────── */
export const typography = {
  fontFamily,
  fontMono,
  fontWeight,
  fontSize: Object.fromEntries(
    Object.entries(typeScale).map(([key, val]) => [key, val.size]),
  ) as Record<TypeLevel, string>,
  lineHeight: Object.fromEntries(
    Object.entries(typeScale).map(([key, val]) => [key, val.lineHeight]),
  ) as Record<TypeLevel, string>,
  /** Complete type scale with all properties */
  scale: typeScale,
} as const;
