import axios from "axios";
import { readAccessToken, readRefreshToken, persistAccessTokenOnly, clearAccessToken } from '../utils/authSession';
import { authService } from './authService';

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  // Render free-tier services sleep after inactivity and take 30-60s to
  // wake up.  60s gives the first cold-start request enough time while
  // still failing fast for genuinely unreachable servers.  The timeout
  // is surfaced via parseApiError as a "timeout" kind (ECONNABORTED).
  timeout: 60_000,
});

// Attach the JWT bearer token (when present) to every request.
// The auth module stores the token under the denscare_-prefixed storage keys
// (localStorage or sessionStorage depending on "remember me"), so
// authenticated API calls work without per-call plumbing.
api.interceptors.request.use((config) => {
  const token = readAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ── 401 / session-expiry handling ───────────────────────────────────── */

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Register a global handler invoked when any API response returns 401
 * (invalid / expired token). AuthProvider registers a handler that clears
 * the persisted session; route guards then redirect to the login page.
 */
export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

/** Unregister the global unauthorized handler (e.g. on provider unmount). */
export function clearUnauthorizedHandler(): void {
  unauthorizedHandler = null;
}

/* ── Token refresh coordination ─────────────────────────────────────── */

/**
 * Refresh state: tracks whether a refresh is in progress and queues
 * pending requests that arrived while the refresh was in flight.
 */
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

/**
 * Process all queued requests after a refresh attempt completes.
 * If refresh succeeded, each request is retried with the new token.
 * If refresh failed, each request is rejected so the caller can handle it.
 */
function processQueue(error: unknown, token: string | null): void {
  for (const prom of failedQueue) {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  }
  failedQueue = [];
}

/**
 * Determine if a 401 error should trigger the refresh flow.
 *
 * Excludes:
 * - /auth/login (401 = invalid credentials, not expired token)
 * - /auth/refresh (must not retry refresh with itself)
 * - /auth/forgot-password (no auth required)
 * - /auth/reset-password (no auth required)
 * - /auth/register (no auth required)
 */
function shouldAttemptRefresh(url: string): boolean {
  const publicPaths = ['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password', '/auth/register'];
  return !publicPaths.some((path) => url.includes(path));
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 *
 * Returns the new access token on success, or throws on failure.
 * Uses a coordination mechanism so that multiple simultaneous 401s
 * only trigger a single refresh request.
 */
async function attemptTokenRefresh(): Promise<string> {
  const refreshToken = readRefreshToken();

  // Single-flight: only one refresh at a time
  if (isRefreshing) {
    // Queue this request to be resolved after the ongoing refresh
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve: resolve as (value: unknown) => void, reject });
    });
  }

  isRefreshing = true;

  try {
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const result = await authService.refreshToken(refreshToken);
    const newToken = result.access_token;

    // Determine the current persistence tier (localStorage vs sessionStorage)
    // by checking which tier has the refresh token stored.
    const storageKey = 'denscare_refresh_token';
    const inSession = sessionStorage.getItem(storageKey) !== null;
    const rememberMe = !inSession;

    persistAccessTokenOnly(newToken, rememberMe);

    processQueue(null, newToken);

    return newToken;
  } catch (error) {
    processQueue(error, null);

    // Refresh failed — clear session and let the handler redirect to login
    clearAccessToken();
    unauthorizedHandler?.();

    throw error;
  } finally {
    isRefreshing = false;
  }
}

// Normalise 401s globally:
// - 401 on `/auth/login` is an *invalid-credentials* failure (surfaced to
//   the login form) — it must NOT clear an existing session or redirect.
// - Any other 401 means the bearer token is invalid/expired (or the user
//   was deactivated) → attempt token refresh first. If refresh fails,
//   invoke the registered handler so the app can clear the session and
//   let the route guards bounce the user to /auth/login.
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as {
      response?: { status?: number };
      config?: { url?: string; _retry?: boolean };
    };
    const status = axiosError.response?.status;
    const url = axiosError.config?.url ?? '';

    if (status === 401 && shouldAttemptRefresh(url) && !axiosError.config?._retry) {
      // Mark this request as already retried to prevent infinite loops
      if (axiosError.config) {
        axiosError.config._retry = true;
      }

      try {
        const newToken = await attemptTokenRefresh();

        // Retry the original request with the new token
        if (axiosError.config) {
          const cfg = axiosError.config as Record<string, unknown>;
          const hdrs = (cfg.headers ?? {}) as Record<string, string>;
          hdrs.Authorization = `Bearer ${newToken}`;
          cfg.headers = hdrs;
        }

        return api.request(axiosError.config!);
      } catch (refreshError) {
        // Refresh failed — the attemptTokenRefresh already cleared the session
        return Promise.reject(error);
      }
    }

    // Non-refreshable 401 (e.g., /auth/login) or non-401 error
    if (status === 401 && !url.includes('/auth/login')) {
      // Only invoke handler if refresh was not attempted (public paths)
      if (!shouldAttemptRefresh(url)) {
        unauthorizedHandler?.();
      }
    }

    return Promise.reject(error);
  },
);