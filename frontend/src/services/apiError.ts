import { AxiosError } from 'axios';

/**
 * Backend error envelope (from `app/core/exception_handlers.py`):
 * ```json
 * { "success": false, "message": "...", "details": ... }
 * ```
 * For 422 validation failures, `details` is an array of Pydantic v2 errors:
 * `[{ "loc": ["body", "first_name"], "msg": "...", "type": "..." }]`.
 */

/**
 * Message shown when a 401 invalidates the current session. Exported so
 * consumers can swap the raw backend detail (e.g. "Not authenticated")
 * for this friendly copy without duplicating the string.
 */
export const AUTH_SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

/**
 * Classification of a failed request. Callers can use `kind` to pick
 * behaviour (e.g. redirect on `auth`) in addition to the human message.
 */
export type ApiErrorKind =
  /** 401 — invalid/expired credentials */
  | 'auth'
  /** 403 — authenticated but not permitted */
  | 'forbidden'
  /** 404 — resource not found */
  | 'not-found'
  /** 422 — request validation failed (details → field errors) */
  | 'validation'
  /** Other 4xx client errors */
  | 'client'
  /** 5xx — server-side failure */
  | 'server'
  /** Request exceeded the configured timeout (no response) */
  | 'timeout'
  /** Browser reported offline (no request sent / no connectivity) */
  | 'offline'
  /** Request sent but the backend is unreachable (no response) */
  | 'backend'
  /** Non-Axios / unrecognised error */
  | 'unknown';

export interface ApiErrorInfo {
  /** Human-readable message suitable for an alert banner */
  message: string;
  /** Field → message map for inline form errors (snake_case keys) */
  fieldErrors: Record<string, string>;
  /**
   * Full dotted-path field errors, e.g. `items.2.medicine_name` (from
   * `loc: ["body","items",2,"medicine_name"]`). Array index paths let
   * array-of-object forms (prescription medicine rows) map each error to
   * the exact row + field instead of colliding on the bare last segment.
   * Top-level fields appear here with the same key as in `fieldErrors`.
   */
  nestedFieldErrors: Record<string, string>;
  /** HTTP status code (null for network-level failures) */
  status: number | null;
  /** Failure classification (see {@link ApiErrorKind}) */
  kind: ApiErrorKind;
}

interface ErrorEnvelope {
  success?: boolean;
  message?: string;
  details?: unknown;
}

interface PydanticFieldError {
  loc?: unknown[];
  msg?: unknown;
  type?: unknown;
}

/** Extract the last `loc` segment as a field key (e.g. ["body","first_name"] → "first_name"). */
function fieldKeyFromLoc(loc: unknown[] | undefined): string | null {
  if (!Array.isArray(loc) || loc.length === 0) return null;
  const last = loc[loc.length - 1];
  return typeof last === 'string' ? last : null;
}

/**
 * Full dotted-path key from a Pydantic `loc` (e.g.
 * ["body","items",2,"medicine_name"] → "items.2.medicine_name").
 * The leading `"body"` is dropped; array indexes are preserved so nested
 * array-of-object errors stay distinct per row.
 */
function nestedFieldKeyFromLoc(loc: unknown[] | undefined): string | null {
  if (!Array.isArray(loc) || loc.length < 2) return null;
  return loc
    .slice(1)
    .map((segment) => String(segment))
    .join('.');
}

/* ── HTTP-status classification ────────────────────────────────────── */

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 422) return 'validation';
  if (status >= 500) return 'server';
  return 'client';
}

/** Context-appropriate fallback message when the backend did not provide one. */
function fallbackMessage(kind: ApiErrorKind, status: number | null): string {
  switch (kind) {
    case 'auth':
      return AUTH_SESSION_EXPIRED_MESSAGE;
    case 'forbidden':
      return 'You do not have permission to perform this action.';
    case 'not-found':
      return 'The requested resource was not found.';
    case 'validation':
      return 'Please review the highlighted fields and try again.';
    case 'server':
      return 'Something went wrong on the server. Please try again later.';
    case 'timeout':
      return 'The request timed out. Please try again.';
    case 'offline':
      return 'You appear to be offline. Check your internet connection and try again.';
    case 'backend':
      return 'Unable to reach the server. It may be offline or starting up — please try again shortly.';
    case 'client':
    case 'unknown':
    default:
      return status ? `Request failed (${status}).` : 'An unexpected error occurred.';
  }
}

/**
 * Normalise any thrown error into a stable, UI-ready shape, classifying the
 * failure so callers can show context-appropriate messages instead of a
 * generic network error.
 *
 * Detects:
 * - **Authentication failures** (401) → `kind: 'auth'`
 * - **Server errors** (5xx) → `kind: 'server'`
 * - **Request timeouts** (axios `ECONNABORTED`) → `kind: 'timeout'`
 * - **Connectivity loss** (browser offline, no response) → `kind: 'offline'`
 * - **Backend unavailable** (request sent, no response, online) → `kind: 'backend'`
 * - HTTP 4xx/5xx with a response → kind from status, backend message preferred
 *
 * Works with:
 * - Backend structured errors (`{ success: false, message, details }`)
 * - Standard FastAPI HTTP errors (message = `detail`)
 * - Network / transport failures (no response)
 */
/**
 * Parse an error and return the message to show the user, swapping the raw
 * backend detail for the friendly session-expired copy on 401s.
 *
 * A single DRY entry point for list/detail containers that render an error
 * panel — avoids re-implementing the `kind === 'auth'` check per module.
 */
export function apiErrorMessage(error: unknown): string {
  const info = parseApiError(error);
  return info.kind === 'auth' ? AUTH_SESSION_EXPIRED_MESSAGE : info.message;
}

/**
 * React Query `retry` callback for queries that must not hammer the server
 * on *expected* authorization failures.
 *
 * - **401/403** → never retry (the outcome will not change; a retry only
 *   adds latency and noise for users without permission).
 * - **Any other failure** (network, 5xx, timeout, …) → retain the global
 *   default behaviour (the app's QueryClient configures `retry: 1`).
 *
 * Usage: `useQuery({ ..., retry: shouldRetryQuery })`.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const info = parseApiError(error);
  if (info.kind === 'auth' || info.kind === 'forbidden') return false;
  // Retain the default single retry for transient failures. Keep this in
  // sync with the QueryClient default (`retry: 1` in main.tsx).
  return failureCount < 1;
}

export function parseApiError(error: unknown): ApiErrorInfo {
  const axiosError = error as AxiosError<ErrorEnvelope>;

  if (!axiosError?.isAxiosError) {
    return {
      kind: 'unknown',
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      fieldErrors: {},
      nestedFieldErrors: {},
      status: null,
    };
  }

  const status = axiosError.response?.status ?? null;
  const data = axiosError.response?.data;

  /* ── Transport-level failures (no HTTP response) ─────────────── */
  if (status === null) {
    // Axios aborts with ECONNABORTED when the request exceeds `timeout`.
    if (axiosError.code === 'ECONNABORTED') {
      return { kind: 'timeout', message: fallbackMessage('timeout', null), fieldErrors: {}, nestedFieldErrors: {}, status: null };
    }

    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      return { kind: 'offline', message: fallbackMessage('offline', null), fieldErrors: {}, nestedFieldErrors: {}, status: null };
    }

    // Online but no response → the backend itself is unreachable.
    return { kind: 'backend', message: fallbackMessage('backend', null), fieldErrors: {}, nestedFieldErrors: {}, status: null };
  }

  /* ── HTTP failures with a response ────────────────────────────── */
  const kind = kindFromStatus(status);
  const message = data?.message ?? fallbackMessage(kind, status);

  const fieldErrors: Record<string, string> = {};
  const nestedFieldErrors: Record<string, string> = {};
  if (Array.isArray(data?.details)) {
    for (const raw of data.details as PydanticFieldError[]) {
      const msg = raw?.msg;
      const key = fieldKeyFromLoc(raw?.loc);
      if (key && typeof msg === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = msg;
      }
      const nestedKey = nestedFieldKeyFromLoc(raw?.loc);
      if (nestedKey && typeof msg === 'string' && !nestedFieldErrors[nestedKey]) {
        nestedFieldErrors[nestedKey] = msg;
      }
    }
  }

  return { message, fieldErrors, nestedFieldErrors, status, kind };
}
