import axios from "axios";
import { readAccessToken } from '../utils/authSession';

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  // Fail fast instead of hanging forever; the timeout is surfaced via
  // parseApiError as a "timeout" kind (axios ECONNABORTED).
  timeout: 15_000,
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

// Normalise 401s globally:
// - 401 on `/auth/login` is an *invalid-credentials* failure (surfaced to
//   the login form) — it must NOT clear an existing session or redirect.
// - Any other 401 means the bearer token is invalid/expired (or the user
//   was deactivated) → invoke the registered handler so the app can clear
//   the session and let the route guards bounce the user to /auth/login.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as {
      response?: { status?: number };
      config?: { url?: string };
    };
    const status = axiosError.response?.status;
    const url = axiosError.config?.url ?? '';

    if (status === 401 && !url.includes('/auth/login')) {
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  },
);