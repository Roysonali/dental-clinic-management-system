import type { ProcedureListParams } from '../../types/procedure';

/**
 * Query key factory for every procedure-catalog query. All keys share the
 * `'procedures'` root so one invalidation call refreshes list, search,
 * active and detail entries (architecture report §9).
 */
export const procedureQueryKeys = {
  all: ['procedures'] as const,
  list: (params: ProcedureListParams) => ['procedures', 'list', params] as const,
  search: (term: string) => ['procedures', 'search', term] as const,
  active: ['procedures', 'active'] as const,
  detail: (id: number) => ['procedures', 'detail', id] as const,
} as const;
