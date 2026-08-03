import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import { patientQueryKeys } from './usePatients';
import type {
  PatientCreatePayload,
  PatientResponse,
  PatientUpdatePayload,
} from '../../types/patient';

/**
 * Mutation hooks for the patient module.
 *
 * All mutations invalidate the `patients` query prefix on success so the
 * list and detail views refetch the freshest data.
 */

/** POST /patients — register a new patient. */
export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation<PatientResponse, Error, PatientCreatePayload>({
    mutationFn: (payload) => patientService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientQueryKeys.all });
    },
  });
}

/** PATCH /patients/{id} — partial update. */
export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation<PatientResponse, Error, { id: string; payload: PatientUpdatePayload }>({
    mutationFn: ({ id, payload }) => patientService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientQueryKeys.all });
    },
  });
}

/** PATCH /patients/{id}/activate — ADMIN only (backend-enforced). */
export function useActivatePatient() {
  const queryClient = useQueryClient();
  return useMutation<PatientResponse, Error, string>({
    mutationFn: (id) => patientService.activate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientQueryKeys.all });
    },
  });
}

/** PATCH /patients/{id}/deactivate — ADMIN only (backend-enforced). */
export function useDeactivatePatient() {
  const queryClient = useQueryClient();
  return useMutation<PatientResponse, Error, string>({
    mutationFn: (id) => patientService.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientQueryKeys.all });
    },
  });
}
