import { useState, useEffect } from 'react';

/**
 * useMediaQuery — tracks whether a CSS media query matches.
 *
 * Used for responsive behaviour where CSS alone is insufficient
 * (e.g., choosing between desktop sidebar collapse and mobile drawer).
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 1023px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
