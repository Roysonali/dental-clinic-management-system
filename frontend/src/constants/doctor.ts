/**
 * Doctor module constants.
 *
 * Maintains alignment with backend `app/modules/doctors/` (constants.py,
 * schemas.py, validators/doctor_validator.py) and `app/core/constants.py`.
 * Do not add values that don't exist upstream.
 */
import type {
  AvailabilityStatus,
  DoctorAvailabilityFilter,
  DoctorGender,
  DoctorSortField,
  DoctorStatusFilter,
  DayOfWeek,
} from '../types/doctor';

/* ── Gender ──────────────────────────────────────────────────────────── */

/** Gender options exactly matching backend GenderEnum. */
export const DOCTOR_GENDERS: readonly DoctorGender[] = [
  'male',
  'female',
  'other',
] as const;

/** Human-readable gender labels (display only). */
export const DOCTOR_GENDER_LABELS: Record<DoctorGender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

/* ── Phone validation (backend PHONE_PATTERN + strip rules) ─────────── */

/**
 * Backend pattern `^\+?[1-9]\d{9,14}$` (10–15 digits, first digit 1–9).
 * NOTE: deliberately different from the Patient module pattern
 * (`^\+?[0-9]{10,15}$`) — do not reuse the patient constant here.
 */
export const DOCTOR_PHONE_PATTERN = /^\+?[1-9]\d{9,14}$/;

/** Backend PHONE_MIN_LENGTH / PHONE_MAX_LENGTH (post-strip). */
export const DOCTOR_PHONE_MIN_LENGTH = 10;
export const DOCTOR_PHONE_MAX_LENGTH = 20;

/* ── Registration number validation ─────────────────────────────────── */

/** Backend normalization: trim + uppercase, then `^[A-Z0-9-]+$`. */
export const DOCTOR_REGISTRATION_PATTERN = /^[A-Z0-9-]+$/;
export const DOCTOR_REGISTRATION_MAX_LENGTH = 100;

/* ── Experience / fee / duration limits ─────────────────────────────── */

export const MIN_YEARS_EXPERIENCE = 0;
export const MAX_YEARS_EXPERIENCE = 50;
export const MIN_CONSULTATION_FEE = 0.01;
export const CONSULTATION_FEE_MAX_DIGITS = 10;
export const CONSULTATION_FEE_DECIMALS = 2;
export const MIN_CONSULTATION_DURATION = 15;
export const MAX_CONSULTATION_DURATION = 240;

/* ── Free-text length limits ─────────────────────────────────────────── */

export const ADDRESS_MAX_LENGTH = 500;
export const QUALIFICATION_MAX_LENGTH = 500;
export const BIOGRAPHY_MAX_LENGTH = 2000;
export const EMERGENCY_CONTACT_NAME_MAX_LENGTH = 100;

/* ── Display ─────────────────────────────────────────────────────────── */

/**
 * Doctor-module presentation currency (approved DensCare product
 * requirement — the clinic bills in INR).
 *
 * Fee displays (list table, mobile card, clinical details card) render
 * through the shared `formatCurrency(value, code)` formatter, which maps
 * INR → ₹ with thousands grouping, e.g. `formatCurrency(15000, 'INR')` →
 * "₹15,000.00". This code is the single point of change for Doctor fee
 * presentation.
 */
export const DOCTOR_CURRENCY_CODE = 'INR' as const;

/** Rupee glyph for the fee input prefix (matches the shared formatter's INR symbol). */
export const DOCTOR_CURRENCY_SYMBOL = '₹' as const;

/* ── List / pagination UI constants ─────────────────────────────────── */

/** Default page size for GET /doctors (matches backend default 20, max 100). */
export const DOCTOR_LIST_PAGE_SIZE = 20;
/** Max page size accepted by the backend. */
export const DOCTOR_MAX_PAGE_SIZE = 100;
/** Search debounce for the doctor list toolbar. */
export const DOCTOR_SEARCH_DEBOUNCE_MS = 350;
/** Default page size for GET /specializations (backend default 20). */
export const SPECIALIZATION_LIST_PAGE_SIZE = 20;

/* ── Sort options (backend Literal) ─────────────────────────────────── */

export const DOCTOR_SORT_FIELDS: readonly {
  value: DoctorSortField;
  label: string;
}[] = [
  { value: 'full_name', label: 'Name' },
  { value: 'years_of_experience', label: 'Years of Experience' },
] as const;

/* ── Filter option descriptors ──────────────────────────────────────── */

export const DOCTOR_STATUS_FILTERS: readonly {
  value: DoctorStatusFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export const DOCTOR_STATUS_LABELS: Record<'active' | 'inactive', string> = {
  active: 'Active',
  inactive: 'Inactive',
};

export const DOCTOR_AVAILABILITY_FILTERS: readonly {
  value: DoctorAvailabilityFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
] as const;

export const DOCTOR_AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
};

/* ── Schedule day labels (0=Monday … 5=Saturday, NO Sunday) ─────────── */

export const DOCTOR_DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
};

/** All configurable weekdays (Monday–Saturday). Sunday is NOT configurable. */
export const DOCTOR_ALL_DAYS: readonly DayOfWeek[] = [0, 1, 2, 3, 4, 5] as const;

/* ── Clinic Default Schedule (mirrors backend app/core/constants.py) ──── */

/**
 * Clinic default working sessions when a doctor has zero custom schedule rows.
 * These values MUST match the backend constants exactly:
 * - CLINIC_MORNING_START = 10:00
 * - CLINIC_MORNING_END   = 13:00
 * - CLINIC_EVENING_START = 17:00
 * - CLINIC_EVENING_END   = 21:00
 *
 * NOTE: This is the single source of truth for clinic defaults on the frontend.
 * If the backend changes these values, update ONLY this location.
 */
export const CLINIC_DEFAULT_SESSIONS: readonly { start: string; end: string }[] = [
  { start: '10:00', end: '13:00' },
  { start: '17:00', end: '21:00' },
] as const;

/** Human-readable label for the clinic default morning session. */
export const CLINIC_MORNING_LABEL = '10:00 AM – 1:00 PM';

/** Human-readable label for the clinic default evening session. */
export const CLINIC_EVENING_LABEL = '5:00 PM – 9:00 PM';

/* ── UserSearchSelect (shared) constants ────────────────────────────── */

/**
 * User-search constants moved to `src/constants/user.ts` (Sprint 11B —
 * Phase 1A). Re-exported here for backward compatibility so existing
 * imports of these names from this module keep working.
 */
export {
  USER_SEARCH_DEBOUNCE_MS,
  USER_SEARCH_PAGE_SIZE,
  USER_SEARCH_STALE_TIME_MS,
} from './user';
