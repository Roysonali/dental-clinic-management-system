/**
 * DensCare Breakpoint Tokens
 * ===========================
 *
 * Reference documentation only. Tailwind CSS breakpoints are used directly
 * in className strings (e.g. `sm:`, `md:`, `lg:`, `xl:`).
 *
 * These constants are useful for programmatic breakpoint detection
 * (e.g. `useMediaQuery` hooks) or CSS-in-JS fallbacks.
 *
 * Usage:
 *   import { breakpoints } from '@/theme';
 *   const matches = window.matchQuery(`(min-width: ${breakpoints.md})`);
 */

export const breakpoints = {
  /** 640px — Small screens (mobile landscape) */
  sm: '640px',
  /** 768px — Medium screens (tablet) */
  md: '768px',
  /** 1024px — Large screens (desktop) */
  lg: '1024px',
  /** 1280px — Extra large screens (wide desktop) */
  xl: '1280px',
  /** 1536px — 2XL screens (ultra-wide) */
  '2xl': '1536px',
} as const;

export type BreakpointKey = keyof typeof breakpoints;
