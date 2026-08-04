import type { FC } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/auth/useAuth';
import { ROUTES } from './routes';
import { RouteLoader } from './RouteLoader';

/**
 * ProtectedRoute — guards authenticated (dashboard) routes.
 *
 * - While the stored token's profile is still loading → full-screen loader.
 * - No valid session → redirect to /auth/login, remembering the intended
 *   destination via `location.state.from` so login can return the user
 *   where they were headed.
 * - Valid session → render the nested routes (Outlet).
 */
export const ProtectedRoute: FC = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <RouteLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH.LOGIN} replace state={{ from: location }} />;
  }

  return <Outlet />;
};
