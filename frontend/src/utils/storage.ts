/**
 * Storage utilities for client-side persistence.
 *
 * Provides a consistent interface over localStorage/sessionStorage
 * with type-safe access and error handling.
 */

const STORAGE_PREFIX = 'denscare_';

/** Get an item from localStorage with optional parsing */
export const getStorageItem = <T = string>(key: string): T | null => {
  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (item === null) return null;
    return JSON.parse(item) as T;
  } catch {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`) as T | null;
  }
};

/** Set an item in localStorage */
export const setStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${key}`,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  } catch {
    // Storage full or unavailable — silently fail
  }
};

/** Remove an item from localStorage */
export const removeStorageItem = (key: string): void => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // Silently fail
  }
};

/** Clear all denscare-prefixed items from localStorage */
export const clearStorage = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Silently fail
  }
};
