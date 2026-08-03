/**
 * DensCare Spacing Tokens
 * ========================
 *
 * Consistent spacing scale used throughout the application.
 * Follows Tailwind's default scale (0.25rem / 4px increments).
 *
 * Usage:
 *   className="p-4 gap-6"          // Tailwind (preferred)
 *   style={{ padding: spacing[4] }} // programmatic fallback
 */

/* ── Numeric Spacing Scale (in rem, matching Tailwind) ──────────────── */
export const spacingScale = {
  0: '0px',
  0.5: '0.125rem',    // 2px
  1: '0.25rem',       // 4px
  1.5: '0.375rem',    // 6px
  2: '0.5rem',        // 8px
  2.5: '0.625rem',    // 10px
  3: '0.75rem',       // 12px
  3.5: '0.875rem',    // 14px
  4: '1rem',          // 16px
  5: '1.25rem',       // 20px
  6: '1.5rem',        // 24px
  7: '1.75rem',       // 28px
  8: '2rem',          // 32px
  9: '2.25rem',       // 36px
  10: '2.5rem',       // 40px
  11: '2.75rem',      // 44px
  12: '3rem',         // 48px
  14: '3.5rem',       // 56px
  16: '4rem',         // 64px
  20: '5rem',         // 80px
  24: '6rem',         // 96px
  28: '7rem',         // 112px
  32: '8rem',         // 128px
  36: '9rem',         // 144px
  40: '10rem',        // 160px
  44: '11rem',        // 176px
  48: '12rem',        // 192px
  52: '13rem',        // 208px
  56: '14rem',        // 224px
  60: '15rem',        // 240px
  64: '16rem',        // 256px
  72: '18rem',        // 288px
  80: '20rem',        // 320px
  96: '24rem',        // 384px
} as const;

export type SpacingToken = keyof typeof spacingScale;

/* ── Semantic Spacing Groups ────────────────────────────────────────── */

/** Element-level spacing (gaps within a component) */
export const elementSpacing = {
  /** Between icon and text within a button/chip */
  iconText: spacingScale[1.5],
  /** Between stacked elements in a component */
  stackGap: spacingScale[2],
  /** Between form fields */
  fieldGap: spacingScale[3],
  /** Padding inside a card */
  cardPadding: spacingScale[4],
  /** Padding inside a compact card */
  cardPaddingSm: spacingScale[3],
} as const;

/** Component-level spacing (gaps between related components) */
export const componentSpacing = {
  /** Between form field groups */
  formStackGap: spacingScale[5],
  /** Between sections in a panel */
  sectionGap: spacingScale[8],
  /** Max width of form panels */
  formMaxWidth: '420px',
} as const;

/** Layout-level spacing (page structure) */
export const layoutSpacing = {
  /** Page padding on desktop */
  pagePaddingX: spacingScale[12],
  pagePaddingY: spacingScale[14],
  /** Page padding on mobile */
  pagePaddingMobileX: spacingScale[6],
  pagePaddingMobileY: spacingScale[10],
  /** Maximum content width */
  contentMaxWidth: '1200px',
  /** Gutter between grid columns */
  gridGap: spacingScale[6],
} as const;

/* ── Compiled export (backward-compatible key access) ───────────────── */
export const spacing = {
  ...spacingScale,
  sectionPadding: 'lg:px-12 lg:py-14',
  sectionPaddingMobile: 'px-6 py-10',
  formMaxWidth: '420px',
  formStackGap: 'gap-5',
  sectionGap: 'gap-8',
  element: elementSpacing,
  component: componentSpacing,
  layout: layoutSpacing,
} as const;
