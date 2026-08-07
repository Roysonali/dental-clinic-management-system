import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { procedureService } from '../../services/procedureService';
import { procedureQueryKeys } from './procedureQueryKeys';
import type { ProcedureListParams, ProcedureResponse } from '../../types/procedure';
import type { PaginatedResponse } from '../../types/treatmentPlan';

/**
 * Paginated procedure list query — GET /procedures with category / active
 * filters and server-side sorting. Uses `keepPreviousData` on paging.
 */
export function useProcedures(params: ProcedureListParams) {
  return useQuery<PaginatedResponse<ProcedureResponse>>({
    queryKey: procedureQueryKeys.list(params),
    queryFn: () => procedureService.list(params),
    placeholderData: keepPreviousData,
  });
}
