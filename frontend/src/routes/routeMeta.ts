import { ROUTES } from './routes';

/**
 * Route metadata — single source of truth for page-level display information.
 *
 * Each entry maps a route path to its display metadata.
 * Future fields: breadcrumb, subtitle, actions, permissions.
 */
export interface RouteMeta {
  /** Page title displayed in the header */
  title: string;
  /** Reserved: breadcrumb segments for the page */
  breadcrumb?: { label: string; href?: string }[];
  /** Reserved: subtitle text */
  subtitle?: string;
}

/**
 * Route-to-metadata mapping.
 *
 * The key must match `location.pathname` exactly.
 * Nested or parameterised routes can be matched by the consuming hook.
 */
const ROUTE_META: Record<string, RouteMeta> = {
  [ROUTES.DASHBOARD]: { title: 'Dashboard' },
  [ROUTES.ADMIN.PENDING_USERS]: { title: 'Pending Approvals' },
  [ROUTES.PATIENTS]: { title: 'Patients' },
  [ROUTES.DOCTORS]: { title: 'Doctors' },
  [ROUTES.APPOINTMENTS]: { title: 'Appointments' },
  [ROUTES.TREATMENT_PLANS]: { title: 'Treatment Plans' },
  [ROUTES.PROCEDURES]: { title: 'Procedure Catalog' },
  [ROUTES.BILLING]: { title: 'Billing' },
  '/inventory': { title: 'Inventory' },
  '/laboratory': { title: 'Laboratory' },
  '/users': { title: 'Users' },
  '/reports': { title: 'Reports' },
  [ROUTES.SETTINGS]: { title: 'Settings' },
};

/**
 * Look up metadata for a given pathname.
 *
 * Falls back to extracting a human-readable title from the path when no
 * exact match exists (e.g. future dynamic routes).
 *
 * @param pathname — `location.pathname` from React Router
 * @returns The matching RouteMeta or a best-guess fallback.
 */
export function getRouteMeta(pathname: string): RouteMeta {
  // 1. Exact match
  const exact = ROUTE_META[pathname];
  if (exact) return exact;

  // 2. Prefix match for nested routes (e.g. /patients/123/edit)
  const prefix = Object.keys(ROUTE_META)
    .filter((key) => pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix) return ROUTE_META[prefix];

  // 3. Fallback: humanise the path segment
  const segment = pathname.split('/').filter(Boolean).pop() ?? 'Dashboard';
  const title = segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { title };
}


