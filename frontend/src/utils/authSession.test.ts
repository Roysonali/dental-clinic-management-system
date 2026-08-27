import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearAccessToken,
  persistAccessToken,
  readAccessToken,
  readRefreshToken,
} from './authSession';

describe('authSession token persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(readAccessToken()).toBeNull();
    expect(readRefreshToken()).toBeNull();
  });

  it('persists to localStorage when remember_me is true', () => {
    persistAccessToken('local-token', 'local-refresh', true);

    expect(localStorage.getItem('denscare_access_token')).toBe('local-token');
    expect(localStorage.getItem('denscare_refresh_token')).toBe('local-refresh');
    expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
    expect(sessionStorage.getItem('denscare_refresh_token')).toBeNull();
    expect(readAccessToken()).toBe('local-token');
    expect(readRefreshToken()).toBe('local-refresh');
  });

  it('persists to sessionStorage when remember_me is false', () => {
    persistAccessToken('session-token', 'session-refresh', false);

    expect(sessionStorage.getItem('denscare_access_token')).toBe('session-token');
    expect(sessionStorage.getItem('denscare_refresh_token')).toBe('session-refresh');
    expect(localStorage.getItem('denscare_access_token')).toBeNull();
    expect(localStorage.getItem('denscare_refresh_token')).toBeNull();
    expect(readAccessToken()).toBe('session-token');
    expect(readRefreshToken()).toBe('session-refresh');
  });

  it('never writes a REMEMBER_ME flag (no unused storage keys)', () => {
    persistAccessToken('local-token', 'local-refresh', true);
    persistAccessToken('session-token', 'session-refresh', false);
    clearAccessToken();

    expect(localStorage.getItem('denscare_remember_me')).toBeNull();
    expect(sessionStorage.getItem('denscare_remember_me')).toBeNull();
  });

  it('clears the stale token on the other tier when the choice changes', () => {
    persistAccessToken('session-token', 'session-refresh', false);
    // User re-signs-in with "remember me" → old session token must not
    // shadow the new localStorage token on the next read.
    persistAccessToken('local-token', 'local-refresh', true);

    expect(localStorage.getItem('denscare_access_token')).toBe('local-token');
    expect(localStorage.getItem('denscare_refresh_token')).toBe('local-refresh');
    expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
    expect(sessionStorage.getItem('denscare_refresh_token')).toBeNull();
    expect(readAccessToken()).toBe('local-token');
    expect(readRefreshToken()).toBe('local-refresh');
  });

  it('clears the token from both tiers', () => {
    persistAccessToken('local-token', 'local-refresh', true);
    sessionStorage.setItem('denscare_access_token', 'stale');
    sessionStorage.setItem('denscare_refresh_token', 'stale-refresh');

    clearAccessToken();

    expect(localStorage.getItem('denscare_access_token')).toBeNull();
    expect(localStorage.getItem('denscare_refresh_token')).toBeNull();
    expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
    expect(sessionStorage.getItem('denscare_refresh_token')).toBeNull();
    expect(readAccessToken()).toBeNull();
    expect(readRefreshToken()).toBeNull();
  });
});
