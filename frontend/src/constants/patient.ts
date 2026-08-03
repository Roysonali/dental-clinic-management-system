/**
 * Patient module constants.
 *
 * Maintains alignment with backend `app/modules/patients/` and
 * `app/core/constants.py`. Do not add values that don't exist upstream.
 */
import type { PatientGender, PatientStatusFilter } from '../types/patient';

/** Gender options exactly matching backend GenderEnum. */
export const PATIENT_GENDERS: readonly PatientGender[] = [
  'male',
  'female',
  'other',
] as const;

/** Human-readable gender labels (display only). */
export const PATIENT_GENDER_LABELS: Record<PatientGender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

/** Default page size for GET /patients (matches backend default 20, max 100). */
export const PATIENT_LIST_PAGE_SIZE = 20;

/** Max page size accepted by the backend. */
export const PATIENT_MAX_PAGE_SIZE = 100;

/** Name charset rule from backend PatientValidators.normalize_names. */
export const PATIENT_NAME_PATTERN = /^[A-Za-z\s'-]+$/;

/** Phone rule from backend schemas: `^\+?[0-9]{10,15}$`. */
export const PATIENT_PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

/** Status filter option descriptors for the list toolbar. */
export const PATIENT_STATUS_FILTERS: readonly {
  value: PatientStatusFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;
