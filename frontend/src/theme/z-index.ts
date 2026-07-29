/**
 * DensCare Z-Index Tokens
 * ========================
 *
 * Centralised layering scale to avoid z-index conflicts.
 *
 * Usage:
 *   className="z-dropdown"    // using Tailwind arbitrary value
 *   style={{ zIndex: zIndex.dropdown }}
 */

export const zIndex = {
  /** Base layer — page content */
  base: 0,
  /** Above content but below stickied headers */
  elevated: 10,
  /** Sticky headers / sticky elements */
  sticky: 20,
  /** Dropdown menus, popovers */
  dropdown: 30,
  /** Off-canvas / slide-in drawers */
  drawer: 40,
  /** Modals / dialogs */
  modal: 50,
  /** Toast notifications */
  notification: 60,
  /** Tooltips */
  tooltip: 70,
  /** Full-screen overlays / loading spinners */
  overlay: 80,
} as const;

export type ZIndexLayer = keyof typeof zIndex;
