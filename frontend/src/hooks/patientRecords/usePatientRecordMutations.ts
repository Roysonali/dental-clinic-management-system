import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientRecordService } from '../../services/patientRecordService';
import { patientRecordQueryKeys } from './patientRecordQueryKeys';
import type {
  PatientRecordCreateRequest,
  PatientRecordResponse,
  PatientRecordUpdateRequest,
  RecordStatus,
} from '../../types/patientRecord';

/**
 * Record-level mutation hooks.
 *
 * Every mutation invalidates the `['patient-records']` root (lists, detail,
 * by-patient) on success so all record views refetch the freshest data.
 * The user-name directory cache (`['patient-record-names']`) is also
 * refreshed — patient/appointment names live under their own domain query
 * keys and are shared/reused via staleTime, so record mutations don't
 * blast those caches (names don't change when a record is created/updated).
 */

/** POST /patient-records — create (DRAFT). 409 → appointment already has a record. */
export function useCreatePatientRecord() {
  const queryClient = useQueryClient();
  return useMutation<PatientRecordResponse, Error, PatientRecordCreateRequest>({
    mutationFn: (payload) => patientRecordService.createRecord(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['patient-record-names'] });
      void queryClient.invalidateQueries({ queryKey: ['appointment-names'] });
    },
  });
}

/** PATCH /patient-records/{id} — partial update (exclude_unset). */
export function useUpdatePatientRecord() {
  const queryClient = useQueryClient();
  return useMutation<
    PatientRecordResponse,
    Error,
    { id: string; payload: PatientRecordUpdateRequest }
  >({
    mutationFn: ({ id, payload }) => patientRecordService.updateRecord(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['patient-record-names'] });
    },
  });
}

/** PATCH /patient-records/{id}/status?new_status= — query parameter, not a body. */
export function useChangeRecordStatus() {
  const queryClient = useQueryClient();
  return useMutation<PatientRecordResponse, Error, { id: string; newStatus: RecordStatus }>({
    mutationFn: ({ id, newStatus }) => patientRecordService.changeStatus(id, newStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.all });
    },
  });
}

/** POST /patient-records/{id}/finalize — {confirm:true}, locks the record. */
export function useFinalizePatientRecord() {
  const queryClient = useQueryClient();
  return useMutation<PatientRecordResponse, Error, string>({
    mutationFn: (id) => patientRecordService.finalizeRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.all });
    },
  });
}

/** DELETE /patient-records/{id} — soft delete, ADMIN only, 204. */
export function useDeletePatientRecord() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => patientRecordService.deleteRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.all });
    },
  });
}
