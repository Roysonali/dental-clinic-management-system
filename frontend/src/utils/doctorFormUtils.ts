import type {
  DoctorCreateRequest,
  DoctorFormValues,
  DoctorGender,
  DoctorResponse,
  DoctorUpdateRequest,
} from '../types/doctor';

/** Empty/whitespace/undefined → null for optional backend fields. */
function optional(value: string | null | undefined): string | null {
  return value == null || value.trim() === '' ? null : value.trim();
}

/**
 * Strip phone formatting — mirrors backend `re.sub(r"[\s\-\(\)]", "", v)`
 * (whitespace, hyphen, parentheses; keeps a leading '+').
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.replace(/[\s\-()]/g, '');
}

/**
 * Normalize a registration number — mirrors backend normalization
 * (trim + uppercase; the `^[A-Z0-9-]+$` pattern is validated separately).
 */
export function normalizeRegistrationNumber(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = value.trim().toUpperCase();
  return cleaned === '' ? null : cleaned;
}

/** Python `str.title()` equivalent for a single word/line. */
function toTitleCase(value: string): string {
  return value.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/**
 * Normalize languages — mirrors backend `DoctorValidators.normalize_languages`:
 * trim, title-case, deduplicate (first occurrence wins), drop empties.
 */
export function normalizeLanguages(value: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const stripped = item.trim();
    if (!stripped) continue;
    const normalized = toTitleCase(stripped);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

/** Parse an optional numeric input ('' → null; invalid → null). */
export function parseOptionalNumber(value: string): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map a full doctor response into editable form values.
 */
export function responseToFormValues(doctor: DoctorResponse): DoctorFormValues {
  return {
    user_id: String(doctor.user_id),
    date_of_birth: doctor.date_of_birth ?? '',
    gender: doctor.gender ?? '',
    primary_phone: doctor.primary_phone,
    address: doctor.address ?? '',
    qualification: doctor.qualification ?? '',
    registration_number: doctor.registration_number ?? '',
    years_of_experience: doctor.years_of_experience == null ? '' : String(doctor.years_of_experience),
    consultation_fee: doctor.consultation_fee == null ? '' : String(doctor.consultation_fee),
    consultation_duration: doctor.consultation_duration == null ? '' : String(doctor.consultation_duration),
    languages_known: doctor.languages_known ?? [],
    profile_photo_url: doctor.profile_photo_url ?? '',
    biography: doctor.biography ?? '',
    emergency_contact_name: doctor.emergency_contact_name ?? '',
    emergency_contact_phone: doctor.emergency_contact_phone ?? '',
  };
}

/**
 * Transform form values into the POST /doctors payload.
 * Optional fields → null when empty; phones/registration/languages normalized.
 */
export function createPayloadFromForm(values: DoctorFormValues): DoctorCreateRequest {
  const languages = normalizeLanguages(values.languages_known);
  return {
    user_id: Number(values.user_id),
    primary_phone: normalizePhone(values.primary_phone) ?? '',
    date_of_birth: optional(values.date_of_birth),
    gender: (optional(values.gender) as DoctorGender | null) ?? null,
    address: optional(values.address),
    qualification: optional(values.qualification),
    registration_number: normalizeRegistrationNumber(optional(values.registration_number)),
    years_of_experience: parseOptionalNumber(values.years_of_experience),
    consultation_fee: parseOptionalNumber(values.consultation_fee),
    consultation_duration: parseOptionalNumber(values.consultation_duration),
    languages_known: languages.length > 0 ? languages : null,
    profile_photo_url: optional(values.profile_photo_url),
    biography: optional(values.biography),
    emergency_contact_name: optional(values.emergency_contact_name),
    emergency_contact_phone: normalizePhone(optional(values.emergency_contact_phone)),
  };
}

/** Deep equality for optional-field values (supports string[] for languages). */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  return a === b;
}

/** True when a value represents "empty" for an optional field. */
function isEffectivelyEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Transform form values into the PATCH /doctors/{id} payload.
 *
 * PATCH semantics (backend `model_dump(exclude_unset=True)`):
 * - **Unchanged** field (equal to the original record) → omitted.
 * - **Explicitly cleared** field (was populated, now empty) → sent as `null`
 *   so the backend clears it — every `DoctorUpdate` optional field permits
 *   `null` (all are `Optional[...] = None`).
 * - **Changed** field → sent with its normalized value.
 *
 * When `original` is not supplied (no baseline), the legacy behaviour is
 * preserved: empty optionals are omitted entirely (cannot distinguish
 * "cleared" from "never set"). The edit flow always passes the fetched
 * record. `primary_phone` is always sent (required on the backend).
 * Read-only fields (`user_id`, `doctor_code`) are never included.
 */
export function updatePayloadFromForm(
  values: DoctorFormValues,
  original?: DoctorResponse | null,
): DoctorUpdateRequest {
  const payload: Record<string, unknown> = {
    primary_phone: normalizePhone(values.primary_phone) ?? '',
  };

  const hasBaseline = original != null;

  /** Include a changed/cleared optional field, omit when unchanged. */
  const setOptional = (key: string, current: unknown, originalValue: unknown) => {
    if (!hasBaseline) {
      // Legacy: no baseline → omit empties.
      if (!isEffectivelyEmpty(current)) payload[key] = current;
      return;
    }
    if (valuesEqual(current, originalValue)) return; // unchanged → omit
    if (isEffectivelyEmpty(current)) {
      payload[key] = null; // explicitly cleared → backend clears the field
      return;
    }
    payload[key] = current; // changed → send normalized value
  };

  setOptional(
    'date_of_birth',
    optional(values.date_of_birth),
    original?.date_of_birth ?? null,
  );
  setOptional('gender', optional(values.gender), original?.gender ?? null);
  setOptional('address', optional(values.address), original?.address ?? null);
  setOptional(
    'qualification',
    optional(values.qualification),
    original?.qualification ?? null,
  );
  setOptional(
    'registration_number',
    normalizeRegistrationNumber(optional(values.registration_number)),
    original?.registration_number ?? null,
  );
  setOptional(
    'years_of_experience',
    parseOptionalNumber(values.years_of_experience),
    original?.years_of_experience ?? null,
  );
  setOptional(
    'consultation_fee',
    parseOptionalNumber(values.consultation_fee),
    original?.consultation_fee ?? null,
  );
  setOptional(
    'consultation_duration',
    parseOptionalNumber(values.consultation_duration),
    original?.consultation_duration ?? null,
  );
  setOptional(
    'languages_known',
    normalizeLanguages(values.languages_known),
    normalizeLanguages(original?.languages_known ?? []),
  );
  setOptional(
    'profile_photo_url',
    optional(values.profile_photo_url),
    original?.profile_photo_url ?? null,
  );
  setOptional('biography', optional(values.biography), original?.biography ?? null);
  setOptional(
    'emergency_contact_name',
    optional(values.emergency_contact_name),
    original?.emergency_contact_name ?? null,
  );
  setOptional(
    'emergency_contact_phone',
    normalizePhone(optional(values.emergency_contact_phone)),
    normalizePhone(original?.emergency_contact_phone ?? null),
  );

  return payload as DoctorUpdateRequest;
}
