import { z } from 'zod';
import {
  ADDRESS_MAX_LENGTH,
  BIOGRAPHY_MAX_LENGTH,
  CONSULTATION_FEE_DECIMALS,
  CONSULTATION_FEE_MAX_DIGITS,
  DOCTOR_GENDERS,
  DOCTOR_PHONE_MAX_LENGTH,
  DOCTOR_PHONE_MIN_LENGTH,
  DOCTOR_PHONE_PATTERN,
  DOCTOR_REGISTRATION_MAX_LENGTH,
  DOCTOR_REGISTRATION_PATTERN,
  EMERGENCY_CONTACT_NAME_MAX_LENGTH,
  MAX_CONSULTATION_DURATION,
  MAX_YEARS_EXPERIENCE,
  MIN_CONSULTATION_DURATION,
  MIN_YEARS_EXPERIENCE,
  QUALIFICATION_MAX_LENGTH,
} from '../constants/doctor';
import {
  normalizePhone,
  normalizeRegistrationNumber,
} from './doctorFormUtils';

/* ── Shared field rules — mirror backend DoctorValidators + schemas ──── */

const PHONE_ERROR = `Phone must be 10–15 digits with an optional leading +`;

/** Backend: strip `[\s-()]` then match `^\+?[1-9]\d{9,14}$`, length 10–20. */
const phoneRule = z
  .string()
  .trim()
  .min(1, 'Phone is required')
  .refine((value) => {
    const normalized = normalizePhone(value) ?? '';
    return (
      normalized.length >= DOCTOR_PHONE_MIN_LENGTH &&
      normalized.length <= DOCTOR_PHONE_MAX_LENGTH &&
      DOCTOR_PHONE_PATTERN.test(normalized)
    );
  }, PHONE_ERROR);

/** Optional phone: empty string allowed, otherwise the same rule. */
const optionalPhoneRule = z.union([z.literal(''), phoneRule]);

/**
 * Backend: trim + uppercase, then `^[A-Z0-9-]+$`, ≤ 100 chars.
 * NOTE: the raw form value is validated via its normalized form (mirrors
 * the backend `mode="before"` normalization).
 */
const optionalRegistrationRule = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .max(DOCTOR_REGISTRATION_MAX_LENGTH, `Registration number must be at most ${DOCTOR_REGISTRATION_MAX_LENGTH} characters`)
    .refine(
      (value) => DOCTOR_REGISTRATION_PATTERN.test(normalizeRegistrationNumber(value) ?? ''),
      'Registration number may only contain uppercase letters, digits, and hyphens after normalization.',
    ),
]);

/** Backend: ISO date, year ≥ 1900, not in the future. */
const dateOfBirthRule = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth is invalid')
  .refine((value) => Number(value.slice(0, 4)) >= 1900, 'Date of birth is invalid')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const dob = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dob <= today;
  }, 'Date of birth cannot be in the future.');

const optionalDateRule = z.union([z.literal(''), dateOfBirthRule]);

const optionalGenderRule = z.union([
  z.literal(''),
  z
    .string()
    .refine((value) => (DOCTOR_GENDERS as readonly string[]).includes(value), 'Gender is invalid'),
]);

/** Optional integer input held as a string, within [min, max]. */
function optionalInteger(min: number, max: number, label: string) {
  return z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^\d+$/, `${label} must be a whole number`)
      .refine(
        (value) => Number(value) >= min && Number(value) <= max,
        `${label} must be between ${min} and ${max}`,
      ),
  ]);
}

/**
 * Backend: > 0, ≤ 10 digits, ≤ 2 decimal places, multiple of 0.01.
 * Digits are counted on the non-decimal form (e.g. 12345678.90 → 10).
 */
const optionalFeeRule = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d+(\\.\\d{1,${CONSULTATION_FEE_DECIMALS}})?$`),
      `Consultation fee must have at most ${CONSULTATION_FEE_DECIMALS} decimal places`,
    )
    .refine((value) => Number(value) > 0, 'Consultation fee must be greater than 0')
    .refine(
      (value) => value.replace('.', '').length <= CONSULTATION_FEE_MAX_DIGITS,
      `Consultation fee must have at most ${CONSULTATION_FEE_MAX_DIGITS} digits`,
    ),
]);

/** Optional free-text with a max length (empty allowed). */
function optionalText(max: number, label: string) {
  return z.union([
    z.literal(''),
    z.string().trim().max(max, `${label} must be at most ${max} characters`),
  ]);
}

/** Backend: not whitespace-only, ≤ 2000 chars. */
const optionalBiographyRule = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .max(BIOGRAPHY_MAX_LENGTH, `Biography must be at most ${BIOGRAPHY_MAX_LENGTH} characters`)
    .refine((value) => value.length > 0, 'Biography must not be whitespace-only'),
]);

/** Backend: each language non-empty (trimmed) — backend title-cases/dedupes. */
const languagesRule = z
  .array(z.string())
  .refine(
    (items) => items.every((item) => item.trim().length > 0),
    'Languages must not be empty or whitespace-only',
  );

const optionalUrlRule = z.union([
  z.literal(''),
  z.string().trim().url('Profile photo URL is invalid'),
]);

/* ── Doctor form schema (create + edit share one schema) ─────────────── */

export const doctorFormSchema = z.object({
  /** Set by UserSearchSelect (create) or prefilled from the record (edit). */
  user_id: z
    .string()
    .min(1, 'User is required')
    .refine((value) => /^\d+$/.test(value) && Number(value) > 0, 'User is required'),
  date_of_birth: optionalDateRule,
  gender: optionalGenderRule,
  primary_phone: phoneRule,
  address: optionalText(ADDRESS_MAX_LENGTH, 'Address'),
  qualification: optionalText(QUALIFICATION_MAX_LENGTH, 'Qualification'),
  registration_number: optionalRegistrationRule,
  years_of_experience: optionalInteger(MIN_YEARS_EXPERIENCE, MAX_YEARS_EXPERIENCE, 'Years of experience'),
  consultation_fee: optionalFeeRule,
  consultation_duration: optionalInteger(MIN_CONSULTATION_DURATION, MAX_CONSULTATION_DURATION, 'Consultation duration'),
  languages_known: languagesRule,
  profile_photo_url: optionalUrlRule,
  biography: optionalBiographyRule,
  emergency_contact_name: optionalText(EMERGENCY_CONTACT_NAME_MAX_LENGTH, 'Emergency contact name'),
  emergency_contact_phone: optionalPhoneRule,
});

/** Inferred type — must stay assignable to DoctorFormValues for RHF. */
export type DoctorFormSchema = z.infer<typeof doctorFormSchema>;
