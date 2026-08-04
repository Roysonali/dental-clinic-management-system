import { AUTH_STORAGE_KEYS } from '../constants/auth';
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from './storage';

/**
 * Token persistence helpers.
 *
 * The "remember me" choice decides where the access token lives:
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

/** Persist the access token on the storage tier matching `rememberMe`. */
export function persistAccessToken(token: string, rememberMe: boolean): void {
  const target = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;

  // Never leave a stale token on the other tier — it would shadow the
  // freshly chosen persistence level on the next read.
  removeStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, other);
  setStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, token, target);
}

/** Remove the access token from both tiers. */
export function clearAccessToken(): void {
  removeStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, localStorage);
  removeStorageItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, sessionStorage);
}
