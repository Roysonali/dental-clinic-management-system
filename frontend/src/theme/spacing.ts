/**
 * DensCare Spacing Tokens
 *
 * Tailwind's default spacing scale (0.25rem increments) is used.
 * This file documents common semantic spacing values for reference.
 */

export const spacing = {
  /** Section padding on desktop */
  sectionPadding: 'lg:px-12 lg:py-14',
  /** Section padding on mobile */
  sectionPaddingMobile: 'px-6 py-10',
  /** Max width of form panels */
  formMaxWidth: '420px',
  /** Gap between stacked form elements */
  formStackGap: 'gap-5',
  /** Gap between header and form */
  sectionGap: 'gap-8',
} as const;
