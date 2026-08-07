import { useQuery } from '@tanstack/react-query';
import { procedureService } from '../../services/procedureService';
import { procedureQueryKeys } from './procedureQueryKeys';
import type { ProcedureResponse } from '../../types/procedure';

/** Single procedure query — GET /procedures/{id} (edit-drawer source). */
export function useProcedure(id: number | null, enabled = true) {
  return useQuery<ProcedureResponse>({
    queryKey: procedureQueryKeys.detail(id ?? 0),
    queryFn: () => procedureService.get(id as number),
    enabled: enabled && id !== null,
  });
}
