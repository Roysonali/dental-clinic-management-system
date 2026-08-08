import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { patientRecordService } from '../../services/patientRecordService';
import { shouldRetryQuery } from '../../services/apiError';
import { patientRecordQueryKeys } from './patientRecordQueryKeys';
import type {
  PatientRecordListEnvelope,
  PatientRecordListItem,
  PatientRecordListParams,
  PatientRecordResponse,
} from '../../types/patientRecord';

/**
 * Paginated patient record list query — GET /patient-records.
 *
 * The backend fully supports server-side search/filter/pagination, so
 * `params` flow straight to the query key and the endpoint. Uses
 * `keepPreviousData` so paging keeps the previous page visible.
 * Never retries 401/403 (cross-role reads without permission are expected).
 */
export function usePatientRecords(params: PatientRecordListParams) {
  return useQuery<PatientRecordListEnvelope<PatientRecordListItem>>({
    queryKey: patientRecordQueryKeys.list(params),
    queryFn: () => patientRecordService.listRecords(params),
    placeholderData: keepPreviousData,
    retry: shouldRetryQuery,
  });
}

/**
 * Full record aggregate query — GET /patient-records/{id}.
 * Disabled until an id is provided.
 */
export function usePatientRecord(id: string | null | undefined, enabled = true) {
  const recordId = id ?? '';
  return useQuery<PatientRecordResponse>({
    queryKey: patientRecordQueryKeys.detail(recordId),
    queryFn: () => patientRecordService.getRecord(recordId),
    enabled: enabled && recordId.length > 0,
    retry: shouldRetryQuery,
  });
}
