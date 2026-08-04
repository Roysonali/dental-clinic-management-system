/**
 * JWT helpers — decode and expiry checks for the DensCare access token.
 *
 * The backend signs tokens with HS256 and embeds `sub` (email), `exp`,
 * `iat`, `jti`, and `token_type: "access"` claims (see
 * `backend/app/core/security.py`). The frontend cannot verify the
 * signature (that requires the server secret) — it only reads the
 * payload for UX decisions (e.g. pre-emptive expiry checks). The
 * backend remains the sole authority on token validity.
 */

/** Decode the payload segment of a JWT without verifying the signature. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const payload = parts[1];

  try {
    // Base64url → standard base64 → string → JSON
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const json = atob(padded);
    const parsed = JSON.parse(json) as unknown;

    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Expiry timestamp (seconds since epoch) from the `exp` claim, or null. */
export function getTokenExpirySeconds(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const exp = payload.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
}

/**
 * True when the token is expired (or has no parseable `exp` claim).
 *
 * @param leewaySeconds — grace period (defaults to 30s, matching the
 *   backend's maximum clock-skew tolerance).
 */
export function isTokenExpired(token: string, leewaySeconds = 30): boolean {
  const exp = getTokenExpirySeconds(token);
  if (exp === null) return true;

  const nowSeconds = Date.now() / 1000;
  return nowSeconds > exp - leewaySeconds;
}
