import { createContext, useContext } from 'react';

/**
 * OverlayLayerContext — shared registry of the "stacking-context root" of
 * the nearest open overlay layer (Drawer or Modal).
 *
 * Floating content (Popover/Tooltip/Dropdown) is rendered via `createPortal`
 * INTO that root element instead of `document.body`. The overlay root is a
 * `fixed inset-0` element with a `z-drawer` / `z-modal` token, i.e. its own
 * stacking context, so the floating layer:
 *
 *   - inherits the overlay's stacking context → always paints above the
 *     drawer/modal panel and backdrop it belongs to;
 *   - escapes any `overflow` / `transform` ancestor (e.g. a Drawer Body with
 *     `overflow-y-auto`), so it is never clipped;
 *   - keeps a small, layer-relative z-index token (tooltip/dropdown/
 *     datepicker) instead of fighting the whole-page stacking order.
 *
 * When no overlay layer is present the consumer falls back to
 * `document.body`.
 */
export interface OverlayLayerContextValue {
  /** Root element of the overlay layer (the `fixed inset-0 z-*` wrapper). */
  containerRef: React.RefObject<HTMLElement | null>;
}

export const OverlayLayerContext = createContext<OverlayLayerContextValue | null>(null);

/** Returns the nearest overlay layer registry, or null when none is open. */
export function useOverlayLayer(): OverlayLayerContextValue | null {
  return useContext(OverlayLayerContext);
}
