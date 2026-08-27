import type {
  PatientCreatePayload,
  PatientFormValues,
  PatientResponse,
  PatientUpdatePayload,
} from '../../types/patient';

/** Empty/whitespace/undefined → null for optional backend fields. */
function optional(value: string | null | undefined): string | null {
  return value == null || value.trim() === '' ? null : value.trim();
}

/** Map a full patient response into editable form values. */
export function patientToFormValues(patient: PatientResponse): Partial<PatientFormValues> {
  return {
    first_name: patient.first_name ?? '',
    middle_name: patient.middle_name ?? '',
    last_name: patient.last_name ?? '',
    date_of_birth: patient.date_of_birth ?? '',
    gender: patient.gender ?? '',
    primary_contact_number: patient.primary_contact_number,
    emergency_contact_number: patient.emergency_contact_number ?? '',
    email: patient.email ?? '',
    address: patient.address ?? '',
    remarks: patient.remarks ?? '',
  };
}

/** Transform form values into the POST /patients payload. */
export function formValuesToCreatePayload(values: PatientFormValues): PatientCreatePayload {
  return {
    first_name: values.first_name.trim(),
    middle_name: optional(values.middle_name),
    last_name: values.last_name.trim(),
    date_of_birth: values.date_of_birth,
    gender: values.gender as PatientCreatePayload['gender'],
    primary_contact_number: values.primary_contact_number.trim(),
    emergency_contact_number: optional(values.emergency_contact_number),
    email: optional(values.email)?.toLowerCase() ?? null,
    address: optional(values.address),
    remarks: optional(values.remarks),
  };
}

/**
 * Transform form values into the PATCH /patients/{id} payload.
 *
 * Mirrors backend `model_dump(exclude_none=True)` semantics: empty optional
 * fields are omitted so they are not overwritten. Required fields are always
 * sent.
 */
export function formValuesToUpdatePayload(values: PatientFormValues): PatientUpdatePayload {
  const payload: PatientUpdatePayload = {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    date_of_birth: values.date_of_birth,
    gender: values.gender as PatientUpdatePayload['gender'],
    primary_contact_number: values.primary_contact_number.trim(),
  };

  const middle = optional(values.middle_name);
  if (middle) payload.middle_name = middle;

  const emergency = optional(values.emergency_contact_number);
  if (emergency) payload.emergency_contact_number = emergency;

  const email = optional(values.email);
  if (email) payload.email = email.toLowerCase();

  const address = optional(values.address);
  if (address) payload.address = address;

  const remarks = optional(values.remarks);
  if (remarks) payload.remarks = remarks;

  return payload;
}
