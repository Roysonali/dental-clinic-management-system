import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearAccessToken,
  persistAccessToken,
  readAccessToken,
} from './authSession';

describe('authSession token persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(readAccessToken()).toBeNull();
  });

  it('persists to localStorage when remember_me is true', () => {
    persistAccessToken('local-token', true);

    expect(localStorage.getItem('denscare_access_token')).toBe('local-token');
    expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
    expect(readAccessToken()).toBe('local-token');
  });

  it('persists to sessionStorage when remember_me is false', () => {
    persistAccessToken('session-token', false);

    expect(sessionStorage.getItem('denscare_access_token')).toBe('session-token');
    expect(localStorage.getItem('denscare_access_token')).toBeNull();
    expect(readAccessToken()).toBe('session-token');
  });

  it('never writes a REMEMBER_ME flag (no unused storage keys)', () => {
    persistAccessToken('local-token', true);
    persistAccessToken('session-token', false);
    clearAccessToken();

    expect(localStorage.getItem('denscare_remember_me')).toBeNull();
    expect(sessionStorage.getItem('denscare_remember_me')).toBeNull();
  });

  it('clears the stale token on the other tier when the choice changes', () => {
    persistAccessToken('session-token', false);
    // User re-signs-in with "remember me" → old session token must not
    // shadow the new localStorage token on the next read.
    persistAccessToken('local-token', true);

    expect(localStorage.getItem('denscare_access_token')).toBe('local-token');
    expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
    expect(readAccessToken()).toBe('local-token');
  });

  it('clears the token from both tiers', () => {
    persistAccessToken('local-token', true);
    sessionStorage.setItem('denscare_access_token', 'stale');

    clearAccessToken();

    expect(localStorage.getItem('denscare_access_token')).toBeNull();
    expect(sessionStorage.getItem('denscare_access_token')).toBeNull();
    expect(readAccessToken()).toBeNull();
  });
});
