import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { api, clearUnauthorizedHandler, registerUnauthorizedHandler } from './api';
import { clearAccessToken, persistAccessToken } from '../utils/authSession';

/**
 * Force every request through a canned failure with the given status so
 * the response interceptor can be exercised without a real backend.
 * The adapter rejects directly with an AxiosError carrying the status —
 * exactly what a real HTTP error looks like to the interceptor.
 */
function stubAdapter(status: number) {
  api.defaults.adapter = async (config) => {
    const response: AxiosResponse = {
      data: { success: false, message: 'Stub' },
      status,
      statusText: 'Stub',
      headers: {},
      config: config as InternalAxiosRequestConfig,
    };
    throw new AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_REQUEST',
      config as InternalAxiosRequestConfig,
      undefined,
      response,
    );
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  clearUnauthorizedHandler();
  api.defaults.adapter = undefined;
});

describe('api response interceptor — 401 handling', () => {
  it('invokes the unauthorized handler on a 401 from a protected endpoint', async () => {
    stubAdapter(401);
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);

    await expect(api.get('/patients')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT invoke the handler on a 401 from /auth/login (invalid credentials)', async () => {
    stubAdapter(401);
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);

    await expect(api.post('/auth/login', new URLSearchParams())).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT invoke the handler for non-401 statuses', async () => {
    stubAdapter(403);
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);

    await expect(api.get('/auth/users/pending')).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when no handler is registered', async () => {
    stubAdapter(401);

    await expect(api.get('/patients')).rejects.toThrow();
  });

  it('stops invoking the handler after clearUnauthorizedHandler', async () => {
    stubAdapter(401);
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);
    clearUnauthorizedHandler();

    await expect(api.get('/patients')).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('clears the persisted session when a 401 fires and the handler is the session-clearer', async () => {
    // Simulates the AuthProvider handler contract: on a protected-endpoint
    // 401, the registered handler clears the token from both storage tiers.
    persistAccessToken('expired-token', true);
    registerUnauthorizedHandler(() => {
      clearAccessToken();
    });
    stubAdapter(401);

    // The rejected request propagates to the caller (request rejected
    // correctly), and the session was cleared in the meantime.
    await expect(api.get('/auth/me')).rejects.toThrow();
    expect(localStorage.getItem('denscare_access_token')).toBeNull();
    expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
  });

  it('does NOT clear the session for a 401 on /auth/login (invalid credentials)', async () => {
    persistAccessToken('valid-token', true);
    const handler = vi.fn(() => {
      clearAccessToken();
    });
    registerUnauthorizedHandler(handler);
    stubAdapter(401);

    await expect(api.post('/auth/login', new URLSearchParams())).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
    // The existing (valid) session must survive an invalid-credentials failure.
    expect(localStorage.getItem('denscare_access_token')).toBe('valid-token');
  });
});
