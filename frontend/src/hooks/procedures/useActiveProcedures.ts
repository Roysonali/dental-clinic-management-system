import { useQuery } from '@tanstack/react-query';
import { procedureService } from '../../services/procedureService';
import { procedureQueryKeys } from './procedureQueryKeys';
import type { ProcedureResponse } from '../../types/procedure';

/**
 * All active procedures — GET /procedures/active (dropdown source for item
 * forms). The catalog is small (50–200 rows) and changes only via admin
 * writes, so a long stale time is used; admin mutations invalidate it.
 */
export function useActiveProcedures() {
  return useQuery<ProcedureResponse[]>({
    queryKey: procedureQueryKeys.active,
    queryFn: () => procedureService.listActive(),
    staleTime: 5 * 60 * 1000,
  });
}
