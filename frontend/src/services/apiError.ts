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
      return 'Your session has expired. Please sign in again.';
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
export function parseApiError(error: unknown): ApiErrorInfo {
  const axiosError = error as AxiosError<ErrorEnvelope>;

  if (!axiosError?.isAxiosError) {
    return {
      kind: 'unknown',
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      fieldErrors: {},
      status: null,
    };
  }

  const status = axiosError.response?.status ?? null;
  const data = axiosError.response?.data;

  /* ── Transport-level failures (no HTTP response) ─────────────── */
  if (status === null) {
    // Axios aborts with ECONNABORTED when the request exceeds `timeout`.
    if (axiosError.code === 'ECONNABORTED') {
      return { kind: 'timeout', message: fallbackMessage('timeout', null), fieldErrors: {}, status: null };
    }

    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      return { kind: 'offline', message: fallbackMessage('offline', null), fieldErrors: {}, status: null };
    }

    // Online but no response → the backend itself is unreachable.
    return { kind: 'backend', message: fallbackMessage('backend', null), fieldErrors: {}, status: null };
  }

  /* ── HTTP failures with a response ────────────────────────────── */
  const kind = kindFromStatus(status);
  const message = data?.message ?? fallbackMessage(kind, status);

  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(data?.details)) {
    for (const raw of data.details as PydanticFieldError[]) {
      const key = fieldKeyFromLoc(raw?.loc);
      const msg = raw?.msg;
      if (key && typeof msg === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = msg;
      }
    }
  }

  return { message, fieldErrors, status, kind };
}
