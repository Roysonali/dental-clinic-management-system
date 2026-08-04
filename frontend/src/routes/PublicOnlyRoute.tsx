import type { FC, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/auth/useAuth';
import { ROUTES } from './routes';
import { RouteLoader } from './RouteLoader';

interface PublicOnlyRouteProps {
  /** Page content rendered when the user is signed out. */
  children: ReactNode;
}

/**
 * PublicOnlyRoute — guards public auth pages (login / register / forgot
 * password).
 *
 * Prevents an already-authenticated user from seeing the login screen by
 * redirecting them to the dashboard. While the session is still being
 * validated, a loader is shown to avoid a login-page flash.
 */
export const PublicOnlyRoute: FC<PublicOnlyRouteProps> = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <RouteLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
};
