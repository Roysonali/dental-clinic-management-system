import { useCallback, useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { parseApiError, shouldRetryQuery } from '../../services/apiError';
import {
  clearUnauthorizedHandler,
  registerUnauthorizedHandler,
} from '../../services/api';
import {
  clearAccessToken,
  persistAccessToken,
  readAccessToken,
} from '../../utils/authSession';
import { AuthContext, type AuthContextValue } from './authContext';
import { authQueryKeys } from './authQueryKeys';
import type { CurrentUserResponse } from '../../types/auth';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider — owns the client-side session.
 *
 * - Reads a persisted token from storage on boot (auto-login / refresh).
 * - Resolves `GET /auth/me` via React Query once a token exists
 *   (invalid/expired tokens → 401 → the global unauthorized handler clears
 *   the session and route guards redirect to login).
 * - `login` persists the token (localStorage when "remember me" is checked,
 *   sessionStorage otherwise) and loads the profile.
 * - `logout` clears the token from both storage tiers and the auth cache.
 */
export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => readAccessToken());

  const meQuery = useQuery<CurrentUserResponse>({
    queryKey: authQueryKeys.me,
    queryFn: () => authService.getMe(),
    enabled: !!token,
    retry: shouldRetryQuery,
  });

  const user = token ? (meQuery.data ?? null) : null;

  // When the token exists but /auth/me fails with a *non-401* error (CORS,
  // server down, network timeout), keep the user in "initializing" state
  // so ProtectedRoute shows a loader instead of immediately redirecting to
  // login.  A 401 is handled separately: the global interceptor fires
  // handleUnauthorized which clears the token, making !!token false and
  // therefore isInitializing false → redirect.
  const meQueryAuthFailure = meQuery.isError && parseApiError(meQuery.error).kind === 'auth';

  /** Global 401 handler — clears the session and lets guards redirect. */
  const handleUnauthorized = useCallback(() => {
    clearAccessToken();
    setToken(null);
    void queryClient.removeQueries({ queryKey: ['auth'] });
  }, [queryClient]);

  useEffect(() => {
    registerUnauthorizedHandler(handleUnauthorized);
    return () => clearUnauthorizedHandler();
  }, [handleUnauthorized]);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      const response = await authService.login(email.trim().toLowerCase(), password);
      persistAccessToken(response.access_token, response.refresh_token, rememberMe);
      setToken(response.access_token);

      // Resolve the profile before returning so the caller can navigate
      // straight into an authenticated screen. React Query dedupes this
      // with the `enabled` me query above (same key), so only one request
      // is sent.
      await queryClient.fetchQuery<CurrentUserResponse>({
        queryKey: authQueryKeys.me,
        queryFn: () => authService.getMe(),
        retry: shouldRetryQuery,
      });
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    clearAccessToken();
    setToken(null);
    void queryClient.removeQueries({ queryKey: ['auth'] });
  }, [queryClient]);

  const refreshUser = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: !!token && !!user,
      isInitializing: !!token && !user && (meQuery.isPending || (meQuery.isError && !meQueryAuthFailure)),
      login,
      logout,
      refreshUser,
    }),
    [token, user, meQuery.isPending, meQuery.isError, meQueryAuthFailure, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
