import { describe, it, expect } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { apiErrorMessage, parseApiError, shouldRetryQuery } from './apiError';

const config: InternalAxiosRequestConfig = {} as InternalAxiosRequestConfig;

/** Build a raw AxiosError without a response (transport-level failure). */
function networkError(code: string, message = 'Network Error'): AxiosError {
  return new AxiosError(message, code, config, undefined, undefined);
}

/** Build an AxiosError with an HTTP response. */
function httpError(status: number, data?: unknown, code = 'ERR_BAD_REQUEST'): AxiosError {
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  } as AxiosResponse;
  return new AxiosError(`Request failed with status code ${status}`, code, config, undefined, response);
}

const envelope = (message: string, details?: unknown) => ({ success: false, message, details });

describe('parseApiError', () => {
  describe('non-Axios errors', () => {
    it('classifies plain Errors as unknown with their message', () => {
      const info = parseApiError(new Error('boom'));
      expect(info.kind).toBe('unknown');
      expect(info.message).toBe('boom');
      expect(info.status).toBeNull();
    });

    it('falls back for arbitrary thrown values', () => {
      const info = parseApiError('oops');
      expect(info.kind).toBe('unknown');
      expect(info.message).toBe('An unexpected error occurred.');
    });
  });

  describe('transport-level failures (no HTTP response)', () => {
    it('detects a timeout (ECONNABORTED)', () => {
      const info = parseApiError(networkError('ECONNABORTED', 'timeout of 15000ms exceeded'));
      expect(info.kind).toBe('timeout');
      expect(info.message).toContain('timed out');
      expect(info.status).toBeNull();
    });

    it('detects connectivity loss when the browser is offline', () => {
      const original = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      try {
        const info = parseApiError(networkError('ERR_NETWORK'));
        expect(info.kind).toBe('offline');
        expect(info.message).toContain('offline');
      } finally {
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: original });
      }
    });

    it('detects an unreachable backend when online (no response)', () => {
      const original = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      try {
        const info = parseApiError(networkError('ERR_NETWORK'));
        expect(info.kind).toBe('backend');
        expect(info.message).toContain('Unable to reach the server');
      } finally {
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: original });
      }
    });
  });

  describe('HTTP failures with a response', () => {
    it('classifies 401 as an authentication failure with a session message', () => {
      const info = parseApiError(httpError(401));
      expect(info.kind).toBe('auth');
      expect(info.message).toContain('session has expired');
      expect(info.status).toBe(401);
    });

    it('prefers the backend message when provided', () => {
      const info = parseApiError(httpError(401, envelope('Invalid or expired token')));
      expect(info.kind).toBe('auth');
      expect(info.message).toBe('Invalid or expired token');
    });

    it('classifies 403 as forbidden', () => {
      const info = parseApiError(httpError(403));
      expect(info.kind).toBe('forbidden');
      expect(info.message).toContain('permission');
    });

    it('classifies 404 as not-found', () => {
      const info = parseApiError(httpError(404));
      expect(info.kind).toBe('not-found');
    });

    it('classifies 5xx as a server error', () => {
      const info = parseApiError(httpError(500, undefined, 'ERR_BAD_RESPONSE'));
      expect(info.kind).toBe('server');
      expect(info.message).toContain('server');
      expect(info.status).toBe(500);
    });

    it('extracts Pydantic 422 field errors into a field map', () => {
      const info = parseApiError(
        httpError(422, envelope('Validation error', [
          { loc: ['body', 'first_name'], msg: 'Field required', type: 'missing' },
          { loc: ['body', 'phone'], msg: 'Invalid phone', type: 'string_pattern_mismatch' },
        ])),
      );
      expect(info.kind).toBe('validation');
      expect(info.fieldErrors).toEqual({ first_name: 'Field required', phone: 'Invalid phone' });
      expect(info.message).toBe('Validation error');
    });

    it('classifies other 4xx as client errors with the status in the fallback', () => {
      const info = parseApiError(httpError(409));
      expect(info.kind).toBe('client');
      expect(info.message).toContain('409');
    });
  });

  describe('apiErrorMessage', () => {
    it('swaps the raw backend detail for the friendly copy on 401', () => {
      const msg = apiErrorMessage(httpError(401, envelope('Not authenticated')));
      expect(msg).toBe('Your session has expired. Please sign in again.');
    });

    it('passes through other error messages unchanged', () => {
      const msg = apiErrorMessage(httpError(500, envelope('Internal error')));
      expect(msg).toBe('Internal error');
    });
  });

  describe('shouldRetryQuery', () => {
    it('never retries 401 authentication failures', () => {
      expect(shouldRetryQuery(0, httpError(401))).toBe(false);
      expect(shouldRetryQuery(1, httpError(401))).toBe(false);
    });

    it('never retries 403 forbidden failures', () => {
      expect(shouldRetryQuery(0, httpError(403))).toBe(false);
      expect(shouldRetryQuery(1, httpError(403))).toBe(false);
    });

    it('retains the default single retry for transient failures', () => {
      expect(shouldRetryQuery(0, httpError(500))).toBe(true);
      expect(shouldRetryQuery(1, httpError(500))).toBe(false);
    });

    it('retains the default single retry for network-level failures', () => {
      expect(shouldRetryQuery(0, networkError('ERR_NETWORK'))).toBe(true);
      expect(shouldRetryQuery(1, networkError('ERR_NETWORK'))).toBe(false);
    });

    it('retains the default single retry for non-Axios errors', () => {
      expect(shouldRetryQuery(0, new Error('boom'))).toBe(true);
      expect(shouldRetryQuery(1, new Error('boom'))).toBe(false);
    });
  });
});
