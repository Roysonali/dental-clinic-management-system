import type { FC } from 'react';
import { Spinner } from '../components/common/Spinner/Spinner';

/**
 * RouteLoader — full-screen loading state shown while the auth session is
 * being validated (stored token → GET /auth/me). Prevents a flash of the
 * login page (or a protected page) before the session resolves.
 */
export const RouteLoader: FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-white">
    <Spinner size="lg" variant="primary" label="Checking your session" />
  </div>
);
