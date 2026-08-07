import { useMutation, useQueryClient } from '@tanstack/react-query';
import { procedureService } from '../../services/procedureService';
import { procedureQueryKeys } from './procedureQueryKeys';
import type {
  ProcedureCreateRequest,
  ProcedureResponse,
  ProcedureUpdateRequest,
} from '../../types/procedure';

/**
 * Procedure catalog mutation hooks (admin ⭐ writes). All invalidate the
 * `'procedures'` root so list, search, active (item-form dropdowns) and
 * detail caches stay consistent (architecture report §9).
 */
function useProcedureWrite<TVariables>(mutationFn: (vars: TVariables) => Promise<ProcedureResponse | void>) {
  const queryClient = useQueryClient();
  return useMutation<ProcedureResponse | void, Error, TVariables>({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: procedureQueryKeys.all });
    },
  });
}

/** POST /procedures (201) — admin only. */
export function useCreateProcedure() {
  return useProcedureWrite<ProcedureCreateRequest>((payload) => procedureService.create(payload));
}

/** PATCH /procedures/{id} — `code` immutable. */
export function useUpdateProcedure() {
  return useProcedureWrite<{ id: number; payload: ProcedureUpdateRequest }>(({ id, payload }) =>
    procedureService.update(id, payload),
  );
}

/** PATCH /procedures/{id}/activate — admin only. */
export function useActivateProcedure() {
  return useProcedureWrite<number>((id) => procedureService.activate(id));
}

/** PATCH /procedures/{id}/deactivate — admin only. */
export function useDeactivateProcedure() {
  return useProcedureWrite<number>((id) => procedureService.deactivate(id));
}

/** DELETE /procedures/{id} (204) — admin only; must be inactive. */
export function useDeleteProcedure() {
  return useProcedureWrite<number>((id) => procedureService.delete(id));
}
