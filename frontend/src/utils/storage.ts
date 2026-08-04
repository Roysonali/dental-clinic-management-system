/**
 * Storage utilities for client-side persistence.
 *
 * Provides a consistent interface over localStorage/sessionStorage
 * with type-safe access and error handling.
 *
 * All functions accept an optional `Storage` backend (defaults to
 * `localStorage`) so auth session code can persist short-lived tokens
 * in `sessionStorage` without duplicating the prefixing logic.
 */

const STORAGE_PREFIX = 'denscare_';

/** Get an item from storage with optional parsing */
export const getStorageItem = <T = string>(
  key: string,
  storage: Storage = localStorage,
): T | null => {
  try {
    const item = storage.getItem(`${STORAGE_PREFIX}${key}`);
    if (item === null) return null;
    return JSON.parse(item) as T;
  } catch {
    return storage.getItem(`${STORAGE_PREFIX}${key}`) as T | null;
  }
};

/** Set an item in storage */
export const setStorageItem = <T>(
  key: string,
  value: T,
  storage: Storage = localStorage,
): void => {
  try {
    storage.setItem(
      `${STORAGE_PREFIX}${key}`,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  } catch {
    // Storage full or unavailable — silently fail
  }
};

/** Remove an item from storage */
export const removeStorageItem = (
  key: string,
  storage: Storage = localStorage,
): void => {
  try {
    storage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // Silently fail
  }
};

/** Clear all denscare-prefixed items from storage */
export const clearStorage = (storage: Storage = localStorage): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  } catch {
    // Silently fail
  }
};
