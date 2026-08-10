import { useState, useEffect } from 'react';

/**
 * Mobile breakpoint for the billing mobile card presentations.
 *
 * The reference mobile screens are ~390px wide and the task targets
 * 320–414px phones. `max-width: 767px` (Tailwind `md`) cleanly covers that
 * range while leaving tablets (768–1023px, which already use the drawer
 * shell + desktop tables) untouched — no desktop/tablet regression.
 */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';

/**
 * useIsMobileViewport — tracks whether the viewport is below the `md`
 * breakpoint (i.e. phones where the billing lists switch from the desktop
 * DataTable to the reference mobile card/list presentation).
 *
 * Safe in environments without `window.matchMedia` (e.g. jsdom tests):
 * falls back to `false` (desktop path), so responsive-only branches are
 * never exercised under test unless the test stubs matchMedia.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
