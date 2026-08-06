import { useState, useEffect } from 'react';

const NARROW_QUERY = '(max-width: 1023px)';

/**
 * useIsNarrowViewport — tracks whether the viewport is below the `lg`
 * breakpoint (i.e. mobile/tablet where tables collapse to cards).
 *
 * Safe in environments without `window.matchMedia` (e.g. jsdom tests):
 * falls back to `false` (desktop path), so responsive-only branches are
 * never exercised under test.
 */
export function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(NARROW_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(NARROW_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isNarrow;
}
