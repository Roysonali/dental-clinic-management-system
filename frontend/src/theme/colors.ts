/**
 * DensCare Color Tokens
 *
 * These values mirror the CSS custom properties defined in `index.css`.
 * Use them for inline styles or programmatic colour access.
 * For Tailwind classes, use the utility classes directly (e.g. `text-primary-500`).
 */

export const colors = {
  /* ── Primary ───────────────────────────────────────────── */
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  } as const,

  /* ── Neutral / Slate ───────────────────────────────────── */
  neutral: {
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
  } as const,

  /* ── Semantic ───────────────────────────────────────────── */
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  finalized: '#4f46e5',
  draft: '#6b7280',

  /* ── Status badges ──────────────────────────────────────── */
  status: {
    active: '#059669',
    inactive: '#94a3b8',
    pending: '#d97706',
    draft: '#6b7280',
    progress: '#2563eb',
    completed: '#059669',
    cancelled: '#dc2626',
    hold: '#d97706',
    finalized: '#4f46e5',
  } as const,
} as const;
