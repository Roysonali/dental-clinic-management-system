import { AUTH_STORAGE_KEYS } from '../constants/auth';
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from './storage';

/**
 * Token persistence helpers.
 *
 * The "remember me" choice decides where the access and refresh tokens live:
 * - `remember_me = true`  → localStorage (survives browser restarts)
 * - `remember_me = false` → sessionStorage (cleared when the tab closes)
 *
 * Reads try sessionStorage first (the most recent explicit choice wins),
 * then fall back to localStorage.
 */

/** Read the persisted access token from either storage tier. */
export function readAccessToken(): string | null {
  return (
    getStorageItem<string>(AUTH_STORAGE_KEYS.ACCESS_TOKEN, sessionStorage) ??
    getStorageItem<string>(AUTH_STORAGE_KEYS.ACCESS_TOKEN, localStorage)
  );
}

/** Read the persisted refresh token from either storage tier. */
export function readRefreshToken(): string | null {
  return (
    getStorageItem<string>(AUTH_STORAGE_KEYS.REFRESH_TOKEN, sessionStorage) ??
    getStorageItem<string>(AUTH_STORAGE_KEYS.REFRESH_TOKEN, localStorage)
  );
}

/** Persist the access and refresh tokens on the storage tier matching `rememberMe`. */
export function persistAccessToken(token: string, refreshToken: string, rememberMe: boolean): void {
  const target = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;

  // Never leave stale tokens on the other tier — it would shadow the
  // freshly chosen persistence level on the next read.
  removeStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, other);
  removeStorageItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, other);
  setStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, token, target);
  setStorageItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken, target);
}

/** Persist only the access token (used after refresh). */
export function persistAccessTokenOnly(token: string, rememberMe: boolean): void {
  const target = rememberMe ? localStorage : sessionStorage;
  setStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, token, target);
}

/** Remove the access and refresh tokens from both tiers. */
export function clearAccessToken(): void {
  removeStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, localStorage);
  removeStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, sessionStorage);
  removeStorageItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, localStorage);
  removeStorageItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, sessionStorage);
}
