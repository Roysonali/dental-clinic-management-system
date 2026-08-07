import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientRecordService } from '../../services/patientRecordService';
import { patientRecordQueryKeys } from './patientRecordQueryKeys';
import type {
  AttachmentCreateRequest,
  AttachmentUpdateRequest,
  DiagnosisCreateRequest,
  DiagnosisResponse,
  DiagnosisUpdateRequest,
  FollowupCreateRequest,
  FollowupUpdateRequest,
  PatientRecordResponse,
  PrescriptionCreateRequest,
  PrescriptionItemCreateRequest,
  PrescriptionItemResponse,
  PrescriptionItemUpdateRequest,
  PrescriptionResponse,
  PrescriptionUpdateRequest,
} from '../../types/patientRecord';

/**
 * Child-entity mutation hooks (diagnoses, prescriptions, items, attachments,
 * follow-ups). Every mutation invalidates the parent record's detail query
 * (counts + nested lists are embedded there) and the specific child list
 * so both the detail aggregate and the tab's own paginated query refetch.
 */
function invalidateRecordChildren(queryClient: ReturnType<typeof useQueryClient>, recordId: string) {
  void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.detail(recordId) });
}

/* ── Diagnoses ──────────────────────────────────────────────────── */

export function useCreateDiagnosis(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<DiagnosisResponse, Error, DiagnosisCreateRequest>({
    mutationFn: (payload) => patientRecordService.createDiagnosis(recordId, payload),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

export function useUpdateDiagnosis(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<DiagnosisResponse, Error, { id: string; payload: DiagnosisUpdateRequest }>({
    mutationFn: ({ id, payload }) => patientRecordService.updateDiagnosis(id, payload),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

export function useDeleteDiagnosis(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => patientRecordService.deleteDiagnosis(id),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

/* ── Prescriptions ──────────────────────────────────────────────── */

export function useCreatePrescription(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<PrescriptionResponse, Error, PrescriptionCreateRequest>({
    mutationFn: (payload) => patientRecordService.createPrescription(recordId, payload),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

export function useUpdatePrescription(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<PrescriptionResponse, Error, { id: string; payload: PrescriptionUpdateRequest }>({
    mutationFn: ({ id, payload }) => patientRecordService.updatePrescription(id, payload),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

export function useDeletePrescription(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => patientRecordService.deletePrescription(id),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

/* ── Prescription items ─────────────────────────────────────────── */

/**
 * Item mutations also receive the parent `recordId` so the record detail
 * aggregate (embedded prescriptions + medicine_count in the prescriptions
 * list) is invalidated — item changes must refresh the whole record, not
 * just the prescription's own queries.
 */
export function useCreatePrescriptionItem(prescriptionId: string, recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<PrescriptionItemResponse, Error, PrescriptionItemCreateRequest>({
    mutationFn: (payload) => patientRecordService.createPrescriptionItem(prescriptionId, payload),
    onSuccess: () => {
      invalidateRecordChildren(queryClient, recordId);
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.prescription(prescriptionId) });
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.prescriptionItems(prescriptionId, {}) });
    },
  });
}

export function useBulkCreatePrescriptionItems(prescriptionId: string, recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<PrescriptionItemResponse[], Error, PrescriptionItemCreateRequest[]>({
    mutationFn: (payload) =>
      patientRecordService.bulkCreatePrescriptionItems(prescriptionId, payload),
    onSuccess: () => {
      invalidateRecordChildren(queryClient, recordId);
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.prescription(prescriptionId) });
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.prescriptionItems(prescriptionId, {}) });
    },
  });
}

export function useUpdatePrescriptionItem(prescriptionId: string, recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    PrescriptionItemResponse,
    Error,
    { id: string; payload: PrescriptionItemUpdateRequest }
  >({
    mutationFn: ({ id, payload }) => patientRecordService.updatePrescriptionItem(id, payload),
    onSuccess: () => {
      invalidateRecordChildren(queryClient, recordId);
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.prescription(prescriptionId) });
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.prescriptionItems(prescriptionId, {}) });
    },
  });
}

export function useDeletePrescriptionItem(prescriptionId: string, recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => patientRecordService.deletePrescriptionItem(id),
    onSuccess: () => {
      invalidateRecordChildren(queryClient, recordId);
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.prescription(prescriptionId) });
      void queryClient.invalidateQueries({ queryKey: patientRecordQueryKeys.prescriptionItems(prescriptionId, {}) });
    },
  });
}

/* ── Attachments ────────────────────────────────────────────────── */

export function useCreateAttachment(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, AttachmentCreateRequest>({
    mutationFn: (payload) => patientRecordService.createAttachment(recordId, payload).then(() => undefined),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

export function useUpdateAttachment(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; payload: AttachmentUpdateRequest }>({
    mutationFn: ({ id, payload }) => patientRecordService.updateAttachment(id, payload).then(() => undefined),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

export function useDeleteAttachment(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => patientRecordService.deleteAttachment(id),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

/* ── Follow-ups ─────────────────────────────────────────────────── */

export function useCreateFollowup(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, FollowupCreateRequest>({
    mutationFn: (payload) => patientRecordService.createFollowup(recordId, payload).then(() => undefined),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

export function useUpdateFollowup(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; payload: FollowupUpdateRequest }>({
    mutationFn: ({ id, payload }) => patientRecordService.updateFollowup(id, payload).then(() => undefined),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

export function useDeleteFollowup(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => patientRecordService.deleteFollowup(id),
    onSuccess: () => invalidateRecordChildren(queryClient, recordId),
  });
}

/** Return type guard for the record aggregate (used by container callbacks). */
export type RecordAggregateMutationSuccess = (record: PatientRecordResponse) => void;
