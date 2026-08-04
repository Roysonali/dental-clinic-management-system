import { createContext } from 'react';
import type { CurrentUserResponse } from '../../types/auth';

/**
 * Auth context value exposed via `useAuth()`.
 *
 * `user` is derived from `GET /auth/me` (React Query) — it is `null`
 * until the profile for the stored token has loaded.
 */
export interface AuthContextValue {
  /** Raw JWT access token (or null when signed out). */
  token: string | null;
  /** Current user profile from GET /auth/me (null while loading/signed out). */
  user: CurrentUserResponse | null;
  /** True when a valid session is fully resolved (token + profile). */
  isAuthenticated: boolean;
  /** True while a stored token's profile is still being validated. */
  isInitializing: boolean;
  /**
   * Sign in with email + password. Persists the token (honouring
   * `rememberMe`) and loads the profile. Rejects with the API error on
   * failure so forms can surface backend messages.
   */
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  /** Sign out: clears the persisted token and cached auth queries. */
  logout: () => void;
  /** Re-fetch the current user profile (e.g. after an account update). */
  refreshUser: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
