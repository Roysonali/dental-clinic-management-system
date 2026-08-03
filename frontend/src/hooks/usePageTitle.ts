import { useLocation } from 'react-router-dom';
import { getRouteMeta } from '../routes/routeMeta';

/**
 * Returns the page title for the current route.
 *
 * Uses React Router's `useLocation` to read the current pathname and
 * looks it up in the route metadata map.  Falls back to a humanised
 * path segment when no exact match is found.
 *
 * @example
 * ```tsx
 * const title = usePageTitle();
 * // → "Dashboard", "Patients", etc.
 * ```
 */
export function usePageTitle(): string {
  const { pathname } = useLocation();
  const meta = getRouteMeta(pathname);
  return meta.title;
}
