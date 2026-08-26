/**
 * Auth module constants.
 *
 * Maintains alignment with the FastAPI backend auth module.
 */

/** Token storage keys (without prefix — storage utility prepends 'denscare_') */
export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_TYPE: 'token_type',
} as const;

/** Auth API error messages */
export const AUTH_ERROR_MESSAGES = {
  LOGIN_FAILED: 'Unable to sign in. Please check your credentials and try again.',
  REGISTRATION_FAILED: 'Registration failed. Please try again later.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
} as const;
