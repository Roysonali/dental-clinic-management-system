import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, getTokenExpirySeconds, isTokenExpired } from './jwt';

/** Build a three-part JWT from a payload object (no signature validation). */
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

const nowSeconds = Math.floor(Date.now() / 1000);

describe('decodeJwtPayload', () => {
  it('decodes a well-formed token payload', () => {
    const token = makeToken({ sub: 'juan@example.com', token_type: 'access' });

    expect(decodeJwtPayload(token)).toEqual({
      sub: 'juan@example.com',
      token_type: 'access',
    });
  });

  it('handles base64url (non-alphabet) characters', () => {
    const raw = { sub: 'a@b.com', data: 'a+b/c_d' };
    const token = makeToken(raw);

    expect(decodeJwtPayload(token)?.data).toBe('a+b/c_d');
  });

  it('returns null for empty / malformed input', () => {
    expect(decodeJwtPayload('')).toBeNull();
    expect(decodeJwtPayload('not-a-token')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
    expect(decodeJwtPayload('a.b.c.d')).toBeNull();
    expect(decodeJwtPayload('header.%%%notjson.signature')).toBeNull();
  });
});

describe('getTokenExpirySeconds', () => {
  it('extracts the exp claim', () => {
    const token = makeToken({ exp: nowSeconds + 3600 });

    expect(getTokenExpirySeconds(token)).toBe(nowSeconds + 3600);
  });

  it('returns null when exp is missing or not a number', () => {
    expect(getTokenExpirySeconds(makeToken({}))).toBeNull();
    expect(getTokenExpirySeconds(makeToken({ exp: 'soon' }))).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('returns false for a token expiring in the future', () => {
    expect(isTokenExpired(makeToken({ exp: nowSeconds + 3600 }))).toBe(false);
  });

  it('returns true for an already-expired token', () => {
    expect(isTokenExpired(makeToken({ exp: nowSeconds - 3600 }))).toBe(true);
  });

  it('honours the leeway window', () => {
    // Expires in 60s — beyond the default 30s leeway → not expired yet.
    expect(isTokenExpired(makeToken({ exp: nowSeconds + 60 }))).toBe(false);
    // Expires in 10s — within the default 30s leeway → treated as expired.
    expect(isTokenExpired(makeToken({ exp: nowSeconds + 10 }))).toBe(true);
    // Already past expiry → expired.
    expect(isTokenExpired(makeToken({ exp: nowSeconds - 10 }))).toBe(true);
  });

  it('returns true when no exp claim is present', () => {
    expect(isTokenExpired(makeToken({}))).toBe(true);
  });
});
