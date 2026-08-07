import { useQuery } from '@tanstack/react-query';
import { procedureService } from '../../services/procedureService';
import { procedureQueryKeys } from './procedureQueryKeys';
import type { ProcedureResponse } from '../../types/procedure';

/**
 * Procedure type-ahead search — GET /procedures/search (code OR name).
 * Enabled only for non-empty terms; caller is expected to debounce `term`.
 */
export function useProcedureSearch(term: string) {
  const trimmed = term.trim();
  return useQuery<ProcedureResponse[]>({
    queryKey: procedureQueryKeys.search(trimmed),
    queryFn: () => procedureService.search(trimmed, 20),
    enabled: trimmed.length > 0,
  });
}
