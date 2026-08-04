import type {
  AppointmentCreatePayload,
  AppointmentFormValues,
  AppointmentResponse,
  AppointmentUpdatePayload,
} from '../../types/appointment';

/* ============================================================
 * Appointment form transformers.
 *
 * Presentational form values (AppointmentFormValues) are NEVER sent to the
 * API as-is — they are converted here, mirroring the patient module's
 * `patientFormUtils`. Time/duration/dentist are kept as strings in the form
 * (native <select>/TimePicker values) and converted to the backend's types.
 * ============================================================ */

/** `HH:MM:SS` (backend) → `HH:MM` (TimePicker). */
export function toTimePickerFormat(time: string): string {
  return time.slice(0, 5);
}

/** `HH:MM` (TimePicker) → `HH:MM:SS` (backend). */
export function toBackendTime(time: string): string {
  return `${time}:00`;
}

/** Map an API appointment onto form values (edit mode pre-fill). */
export function appointmentToFormValues(
  appointment: AppointmentResponse,
): AppointmentFormValues {
  return {
    patient_id: appointment.patient_id,
    dentist_id: String(appointment.dentist_id),
    appointment_date: appointment.appointment_date,
    start_time: toTimePickerFormat(appointment.start_time),
    duration_minutes: String(appointment.duration_minutes),
    appointment_type: appointment.appointment_type,
    reason_for_visit: appointment.reason_for_visit,
    notes: appointment.notes ?? '',
  };
}

/** Map form values onto the POST /appointments payload. */
export function formValuesToCreatePayload(
  values: AppointmentFormValues,
): AppointmentCreatePayload {
  return {
    patient_id: values.patient_id,
    dentist_id: Number(values.dentist_id),
    appointment_date: values.appointment_date,
    start_time: toBackendTime(values.start_time),
    duration_minutes: Number(values.duration_minutes),
    appointment_type: values.appointment_type as AppointmentCreatePayload['appointment_type'],
    reason_for_visit: values.reason_for_visit.trim(),
    notes: values.notes.trim() ? values.notes.trim() : null,
  };
}

/**
 * Map form values onto the PUT /appointments/{id} payload.
 * NOTE: `patient_id` is intentionally omitted — the backend update schema
 * does not accept it (the patient is fixed for the appointment's lifetime).
 */
export function formValuesToUpdatePayload(
  values: AppointmentFormValues,
): AppointmentUpdatePayload {
  return {
    dentist_id: Number(values.dentist_id),
    appointment_date: values.appointment_date,
    start_time: toBackendTime(values.start_time),
    duration_minutes: Number(values.duration_minutes),
    appointment_type: values.appointment_type as AppointmentUpdatePayload['appointment_type'],
    reason_for_visit: values.reason_for_visit.trim(),
    notes: values.notes.trim() ? values.notes.trim() : null,
  };
}
