import { useMemo, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { PatientRecordStatusBadge } from '../patientRecords/PatientRecordStatusBadge';
import { usePatientRecords } from '../../hooks/patientRecords/usePatientRecords';
import { formatISODate } from '../../utils/date';
import { ROUTES } from '../../routes/routes';
import { apiErrorMessage } from '../../services/apiError';
import type { CreateActionType } from './PatientQuickActions';
import type { PatientRecordListItem } from '../../types/patientRecord';

interface PatientRecordsTabProps {
  patientId: string;
  /** Callback to open the contextual create drawer. When provided, the empty-state CTA
   *  uses this instead of navigating away from Patient Hub. */
  onCreateAction?: (action: CreateActionType) => void;
}

/**
 * PatientRecordsTab — renders a paginated list of patient records
 * belonging to a specific patient.
 *
 * Data source: GET /patient-records?patient_id=X
 * Reuses the existing DataTable infrastructure and PatientRecordStatusBadge.
 */
export const PatientRecordsTab: FC<PatientRecordsTabProps> = ({ patientId, onCreateAction }) => {
  const navigate = useNavigate();

  const recordsQuery = usePatientRecords({
    patient_id: patientId,
    page: 1,
    page_size: 20,
  });

  const items = useMemo(
    () => recordsQuery.data?.items ?? [],
    [recordsQuery.data?.items],
  );

  const queryError = recordsQuery.error
    ? apiErrorMessage(recordsQuery.error)
    : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <DataTable<PatientRecordListItem>
        ariaLabel="Patient records"
        data={items}
        rowKey={(record) => record.id}
        loading={recordsQuery.isLoading}
        error={queryError}
        onRetry={() => void recordsQuery.refetch()}
        onRowClick={(record) =>
          navigate(`${ROUTES.PATIENT_RECORDS}/${record.id}`)
        }
        emptyTitle="No patient records"
        emptyDescription="Clinical records for this patient will appear here once created."
        emptyAction={
          <Button
            size="md"
            onClick={() =>
              onCreateAction
                ? onCreateAction('record')
                : navigate(`${ROUTES.PATIENT_RECORDS}?create=true&patientId=${patientId}`)
            }
            leftIcon={<Icon icon={Plus} size="md" />}
            className="shrink-0 whitespace-nowrap"
          >
            New Record
          </Button>
        }
        columns={[
          {
            key: 'status',
            header: 'Status',
            accessor: 'status',
            sortable: true,
            render: (row) => <PatientRecordStatusBadge status={row.status} size="sm" />,
          },
          {
            key: 'chief_complaint',
            header: 'Chief Complaint',
            accessor: 'chief_complaint',
            render: (row) => (
              <span className="text-neutral-900">
                {row.chief_complaint || '—'}
              </span>
            ),
          },
          {
            key: 'created_at',
            header: 'Created',
            accessor: 'created_at',
            sortable: true,
            render: (row) => formatISODate(row.created_at),
          },
        ]}
      />
    </div>
  );
};
