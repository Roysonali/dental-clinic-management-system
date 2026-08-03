import axios from "axios";
import { getStorageItem } from '../utils/storage';
import { AUTH_STORAGE_KEYS } from '../constants/auth';

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  // Fail fast instead of hanging forever; the timeout is surfaced via
  // parseApiError as a "timeout" kind (axios ECONNABORTED).
  timeout: 15_000,
});

// Attach the JWT bearer token (when present) to every request.
// The auth module stores the token under the denscare_-prefixed storage keys,
// so authenticated API calls work without per-call plumbing.
api.interceptors.request.use((config) => {
  const token = getStorageItem<string>(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});