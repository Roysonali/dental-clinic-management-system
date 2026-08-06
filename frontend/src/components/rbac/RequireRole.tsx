import type { FC, ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePermission } from '../../hooks/rbac/usePermission';
import { ROUTES } from '../../routes/routes';
import { RouteLoader } from '../../routes/RouteLoader';
import type { RoleName } from '../../constants/roles';

interface RequireRoleProps {
  /** Roles that may access the wrapped routes. */
  requiredRoles: readonly RoleName[];
  /** Content to render when allowed. When omitted, renders `<Outlet />` (layout-route usage). */
  children?: ReactNode;
  /** Where to send a denied user (defaults to the dashboard). */
  redirectTo?: string;
  /** Optional static node rendered instead of redirecting on denial. */
  deniedFallback?: ReactNode;
}

/**
 * RequireRole — route-level authorization guard (Sprint 11C).
 *
 * Wraps a set of routes (typically as a nested layout route in
 * `AppRouter.tsx`) and enforces the backend's role requirement for them:
 *
 * - Role probe in flight → full-screen loader (same as ProtectedRoute).
 * - Known admin with the required role → renders children / `<Outlet />`.
 * - Known non-admin (or admin without the role) → redirects to
 *   `redirectTo` (dashboard) or renders `deniedFallback` when provided.
 * - Role UNKNOWN (transient probe failure) → renders children (fail-open).
 *   The backend remains the authority — it will 403 if the user truly lacks
 *   permission. Fail-open here prevents a transient network blip from
 *   stranding an admin out of their own screens.
 *
 * The role source is `usePermission()` — see `hooks/rbac/useCurrentUserRole`
 * for how the current user's role is resolved under the backend contract.
 */
export const RequireRole: FC<RequireRoleProps> = ({
  requiredRoles,
  children,
  redirectTo = ROUTES.DASHBOARD,
  deniedFallback,
}) => {
  const { state, can } = usePermission();

  if (state.status === 'loading') {
    return <RouteLoader />;
  }

  if (state.status === 'admin') {
    if (can(requiredRoles)) {
      return <>{children ?? <Outlet />}</>;
    }
    return deniedFallback ?? <Navigate to={redirectTo} replace />;
  }

  if (state.status === 'unknown') {
    // Fail-open: the backend enforces; we must not lock users out on a
    // transient resolution failure.
    return <>{children ?? <Outlet />}</>;
  }

  // Known non-admin — deny.
  return deniedFallback ?? <Navigate to={redirectTo} replace />;
};
