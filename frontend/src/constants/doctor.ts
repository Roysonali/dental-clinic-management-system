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

/** Currency prefix for the consultation fee column (PHP). */
export const CURRENCY_SYMBOL = '₱';

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
