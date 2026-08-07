import type { ChildListParams, PatientRecordListParams } from '../../types/patientRecord';

/**
 * Query key factory for every patient-record query (used for cache
 * invalidation). All keys share the `'patient-records'` root so
 * `invalidateQueries({ queryKey: ['patient-records'] })` invalidates lists,
 * detail and by-patient together. Child collections are keyed under their
 * record's detail key so child mutations can invalidate just that record.
 */
export const patientRecordQueryKeys = {
  all: ['patient-records'] as const,
  list: (params: PatientRecordListParams) => ['patient-records', 'list', params] as const,
  byPatient: (patientId: string, params: PatientRecordListParams) =>
    ['patient-records', 'by-patient', patientId, params] as const,
  byAppointment: (appointmentId: string) =>
    ['patient-records', 'by-appointment', appointmentId] as const,
  detail: (id: string) => ['patient-records', 'detail', id] as const,
  diagnoses: (recordId: string, params: ChildListParams & { diagnosis_type?: string }) =>
    ['patient-records', 'detail', recordId, 'diagnoses', params] as const,
  /** Single diagnosis detail (used to pre-fill notes on edit). */
  diagnosis: (recordId: string, id: string) =>
    ['patient-records', 'detail', recordId, 'diagnoses', 'detail', id] as const,
  prescriptions: (recordId: string, params: ChildListParams) =>
    ['patient-records', 'detail', recordId, 'prescriptions', params] as const,
  prescription: (id: string) => ['prescriptions', 'detail', id] as const,
  prescriptionItems: (prescriptionId: string, params: ChildListParams) =>
    ['prescriptions', 'detail', prescriptionId, 'items', params] as const,
  attachments: (recordId: string, params: ChildListParams) =>
    ['patient-records', 'detail', recordId, 'attachments', params] as const,
  attachment: (id: string) => ['attachments', 'detail', id] as const,
  followups: (recordId: string, params: ChildListParams) =>
    ['patient-records', 'detail', recordId, 'followups', params] as const,
} as const;

/** Names cache key (patient/appointment/user display-name resolution). */
export const patientRecordNamesKey = (
  patientIds: readonly string[],
  appointmentIds: readonly string[],
  userIds: readonly number[],
) => ['patient-record-names', { patients: patientIds, appointments: appointmentIds, users: userIds }] as const;
