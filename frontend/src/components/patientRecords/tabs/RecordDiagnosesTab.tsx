import { useState, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../common/Card/Card';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { IconButton } from '../../common/Button/IconButton';
import { Select } from '../../common/Input/Select';
import { Badge } from '../../common/Badge';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Pagination } from '../../common/Pagination/Pagination';
import { DiagnosisFormDialog, type DiagnosisEditTarget } from '../dialogs/DiagnosisFormDialog';
import { DiagnosisDeleteConfirm } from '../dialogs/DiagnosisDeleteConfirm';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientRecordQueryKeys } from '../../../hooks/patientRecords/patientRecordQueryKeys';
import {
  useCreateDiagnosis,
  useDeleteDiagnosis,
  useUpdateDiagnosis,
} from '../../../hooks/patientRecords/usePatientRecordChildMutations';
import {
  diagnosisFormValuesToCreateRequest,
  diagnosisFormValuesToUpdateRequest,
} from '../../../utils/patientRecordFormUtils';
import { parseApiError } from '../../../services/apiError';
import { formatISODate } from '../../../utils/date';
import { DIAGNOSIS_TYPE_FILTERS, DIAGNOSIS_TYPE_LABELS, DIAGNOSIS_TYPE_VARIANTS } from '../../../constants/patientRecord';
import type { DiagnosisFormValues, DiagnosisListItem } from '../../../types/patientRecord';

interface RecordDiagnosesTabProps {
  recordId: string;
  isFinalized: boolean;
  /** Success feedback callback (toast owned by the detail container). */
  notify: (variant: 'success', title: string, description?: string) => void;
}

/** Own pagination + type filter for the diagnoses tab. */
function useDiagnosesState() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilterState] = useState<'all' | 'PROVISIONAL' | 'CONFIRMED'>('all');
  // L-2: a narrower filter can leave the table beyond the last page, so a
  // filter change always returns to page 1.
  const setTypeFilter = (value: 'all' | 'PROVISIONAL' | 'CONFIRMED') => {
    setTypeFilterState(value);
    setPage(1);
  };
  return { page, setPage, typeFilter, setTypeFilter };
}

/**
 * RecordDiagnosesTab — S-08 diagnoses tab ([UI spec S-08]).
 *
 * Uses the paginated list endpoint (GET /patient-records/{id}/diagnoses)
 * with the backend-supported diagnosis_type filter. No search (the backend
 * has none). Add/Edit/Delete hidden once the record is finalized (all child
 * mutations → 400).
 */
export const RecordDiagnosesTab: FC<RecordDiagnosesTabProps> = ({
  recordId,
  isFinalized,
  notify,
}) => {
  const { page, setPage, typeFilter, setTypeFilter } = useDiagnosesState();

  const listQuery = useQuery({
    queryKey: patientRecordQueryKeys.diagnoses(recordId, { page, page_size: 10, diagnosis_type: typeFilter }),
    queryFn: () =>
      patientRecordService.listDiagnoses(recordId, {
        page,
        page_size: 10,
        diagnosis_type: typeFilter === 'all' ? undefined : typeFilter,
      }),
    enabled: recordId.length > 0,
  });

  const createMutation = useCreateDiagnosis(recordId);
  const updateMutation = useUpdateDiagnosis(recordId);
  const deleteMutation = useDeleteDiagnosis(recordId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DiagnosisEditTarget | null>(null);
  const [deleting, setDeleting] = useState<DiagnosisListItem | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  // L-4: the list payload omits `notes`, so edit mode fetches the diagnosis
  // detail (GET /diagnoses/{id}) to show + clear the stored notes — the same
  // fetch-detail-to-pre-fill pattern as PrescriptionNotesDialog.
  const editingId = editing?.id ?? '';
  const editingDetailQuery = useQuery({
    queryKey: patientRecordQueryKeys.diagnosis(recordId, editingId),
    queryFn: () => patientRecordService.getDiagnosis(editingId),
    enabled: formOpen && editingId.length > 0,
  });
  const editingTarget: DiagnosisEditTarget | null = editing
    ? { ...editing, notes: editingDetailQuery.data?.notes ?? null }
    : null;

  const items = listQuery.data?.items ?? [];
  const totalPages = Math.max(1, listQuery.data?.pages ?? 1);
  const errorMessage = listQuery.error ? parseApiError(listQuery.error).message : null;

  const openCreate = () => {
    setServerErrors({});
    setServerMessage(null);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (diagnosis: DiagnosisListItem) => {
    setServerErrors({});
    setServerMessage(null);
    // Start with unknown notes (null) — the detail query fills them in.
    setEditing({ ...diagnosis, notes: null });
    setFormOpen(true);
  };

  const handleSubmit = (values: DiagnosisFormValues) => {
    setServerErrors({});
    setServerMessage(null);
    if (editingTarget) {
      // Pass the FETCHED notes as the original so clearing the field sends an
      // explicit `null` (erases stored notes) instead of being omitted.
      updateMutation.mutate(
        { id: editingTarget.id, payload: diagnosisFormValuesToUpdateRequest(values, editingTarget) },
        {
          onSuccess: () => {
            setFormOpen(false);
            notify('success', 'Diagnosis updated');
          },
          onError: (error) => handleError(error),
        },
      );
    } else {
      createMutation.mutate(diagnosisFormValuesToCreateRequest(values), {
        onSuccess: () => {
          setFormOpen(false);
          notify('success', 'Diagnosis added');
        },
        onError: (error) => handleError(error),
      });
    }
  };

  const handleError = (error: Error) => {
    const info = parseApiError(error);
    if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
      setServerErrors(info.fieldErrors);
    } else {
      setServerMessage(info.message);
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        notify('success', 'Diagnosis removed');
      },
      onError: (error) => setServerMessage(parseApiError(error).message),
    });
  };

  const columns: DataTableColumn<DiagnosisListItem>[] = [
    {
      key: 'diagnosis_name',
      header: 'Diagnosis',
      render: (row) => <span className="font-medium text-neutral-900">{row.diagnosis_name}</span>,
    },
    {
      key: 'diagnosis_type',
      header: 'Type',
      render: (row) => (
        <Badge variant={DIAGNOSIS_TYPE_VARIANTS[row.diagnosis_type]} size="sm">
          {DIAGNOSIS_TYPE_LABELS[row.diagnosis_type]}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => <span className="text-neutral-600">{formatISODate(row.created_at)}</span>,
    },
  ];

  return (
    <Card>
      <Card.Header
        title="Diagnoses"
        actions={
          !isFinalized ? (
            <div className="flex items-center gap-2">
              <Select
                label=""
                options={DIAGNOSIS_TYPE_FILTERS}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                wrapperClassName="w-40"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={openCreate}
                leftIcon={<Icon icon={Plus} size="xs" />}
              >
                Add Diagnosis
              </Button>
            </div>
          ) : undefined
        }
      />
      <Card.Body>
        <DataTable
          columns={columns}
          data={items}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading}
          error={errorMessage}
          onRetry={() => void listQuery.refetch()}
          ariaLabel="Diagnoses"
          emptyTitle="No diagnoses yet"
          emptyDescription="Add a diagnosis to this clinical record."
          emptyAction={
            !isFinalized ? (
              <Button variant="primary" size="sm" onClick={openCreate}>
                Add Diagnosis
              </Button>
            ) : undefined
          }
          rowActionsHeader=""
          rowActions={(row) =>
            !isFinalized ? (
              <div className="flex items-center justify-end gap-1">
                <IconButton
                  icon={<Icon icon={Pencil} size="sm" />}
                  aria-label={`Edit diagnosis ${row.diagnosis_name}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(row)}
                />
                <IconButton
                  icon={<Icon icon={Trash2} size="sm" />}
                  aria-label={`Delete diagnosis ${row.diagnosis_name}`}
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger/10"
                  onClick={() => {
                    setServerMessage(null);
                    setDeleting(row);
                  }}
                />
              </div>
            ) : undefined
          }
        />

        {!listQuery.isLoading && items.length > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalCount={listQuery.data?.total}
              pageSize={10}
            />
          </div>
        )}
      </Card.Body>

      <DiagnosisFormDialog
        open={formOpen}
        diagnosis={editingTarget}
        loading={formOpen && editing != null && editingDetailQuery.isPending}
        submitting={createMutation.isPending || updateMutation.isPending}
        serverErrors={serverErrors}
        serverMessage={serverMessage}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
      />

      <DiagnosisDeleteConfirm
        open={deleting !== null}
        diagnosisName={deleting?.diagnosis_name ?? null}
        submitting={deleteMutation.isPending}
        error={serverMessage}
        onConfirm={handleDelete}
        onClose={() => {
          setDeleting(null);
          setServerMessage(null);
        }}
      />
    </Card>
  );
};
