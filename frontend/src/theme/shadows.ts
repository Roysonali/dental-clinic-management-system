/**
 * DensCare Shadow Tokens
 * =======================
 *
 * Usage:
 *   className="shadow-md"          // Tailwind (preferred)
 *   style={{ boxShadow: shadows.md }} // programmatic
 */

export const shadows = {
  /** Subtle — cards on neutral backgrounds */
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  /** Default — elevated cards, dropdowns */
  md: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
  /** Large — modals, dialogs */
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
  /** Extra large — fullscreen overlays */
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.05)',
  /** Focus ring — for custom focus styles */
  focus: '0 0 0 2px rgb(59 130 246 / 0.3)',          // primary-500 at 30%
  /** Danger focus ring */
  focusDanger: '0 0 0 2px rgb(220 38 38 / 0.3)',     // danger at 30%
  /** Inner shadow — inset depth */
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

export type ShadowToken = keyof typeof shadows;
