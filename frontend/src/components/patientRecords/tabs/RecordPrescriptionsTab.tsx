import { useMemo, useState, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Pill } from 'lucide-react';
import { Card } from '../../common/Card/Card';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { IconButton } from '../../common/Button/IconButton';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Pagination } from '../../common/Pagination/Pagination';
import { PrescriptionCreateDrawer } from '../dialogs/PrescriptionCreateDrawer';
import { PrescriptionNotesDialog } from '../dialogs/PrescriptionNotesDialog';
import { PrescriptionDeleteConfirm } from '../dialogs/PrescriptionDeleteConfirm';
import { PrescriptionViewDrawer } from '../dialogs/PrescriptionViewDrawer';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientRecordQueryKeys } from '../../../hooks/patientRecords/patientRecordQueryKeys';
import { usePatientRecordNames } from '../../../hooks/patientRecords/usePatientRecordNames';
import {
  useCreatePrescription,
  useDeletePrescription,
  useUpdatePrescription,
} from '../../../hooks/patientRecords/usePatientRecordChildMutations';
import {
  prescriptionFormValuesToCreateRequest,
  prescriptionNotesToUpdateRequest,
} from '../../../utils/patientRecordFormUtils';
import { parseApiError } from '../../../services/apiError';
import { formatISODate } from '../../../utils/date';
import type {
  PrescriptionFormValues,
  PrescriptionListItem,
} from '../../../types/patientRecord';

interface RecordPrescriptionsTabProps {
  recordId: string;
  /** Parent record's patient id — passed to the view drawer for the printable document. */
  patientId: string;
  /** Resolved patient display name — same best-effort resolution as the page header. */
  patientName: string | null;
  isFinalized: boolean;
  notify: (variant: 'success', title: string, description?: string) => void;
}

/**
 * RecordPrescriptionsTab — S-09 prescriptions tab ([UI spec S-09]).
 *
 * Table from the list payload: prescribed_at · prescribed_by (resolved user
 * name, "User #id" fallback) · medicine_count (from the response — never
 * recomputed). Actions: New prescription, View items, Edit notes (notes
 * only — the backend PATCH accepts just notes), Delete. All hidden once the
 * record is finalized.
 */
export const RecordPrescriptionsTab: FC<RecordPrescriptionsTabProps> = ({
  recordId,
  patientId,
  patientName,
  isFinalized,
  notify,
}) => {
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: patientRecordQueryKeys.prescriptions(recordId, { page, page_size: 10 }),
    queryFn: () => patientRecordService.listPrescriptions(recordId, { page, page_size: 10 }),
    enabled: recordId.length > 0,
  });

  const items = listQuery.data?.items ?? [];
  const totalPages = Math.max(1, listQuery.data?.pages ?? 1);
  const errorMessage = listQuery.error ? parseApiError(listQuery.error).message : null;

  // Resolve prescriber names (int user ids) — best-effort, "User #id" fallback.
  // Depends on listQuery.data?.items (a stable cached reference) rather than
  // the `items ?? []` recreated array to keep the memo dependency stable.
  const userIds = useMemo(
    () =>
      Array.from(new Set((listQuery.data?.items ?? []).map((p) => p.prescribed_by))).sort(
        (a, b) => a - b,
      ),
    [listQuery.data?.items],
  );
  const names = usePatientRecordNames([], [], userIds);

  const createMutation = useCreatePrescription(recordId);
  const updateMutation = useUpdatePrescription(recordId);
  const deleteMutation = useDeletePrescription(recordId);

  const [createOpen, setCreateOpen] = useState(false);
  const [notesTarget, setNotesTarget] = useState<PrescriptionListItem | null>(null);
  const [deleting, setDeleting] = useState<PrescriptionListItem | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const handleCreate = (values: PrescriptionFormValues) => {
    setServerErrors({});
    setServerMessage(null);
    createMutation.mutate(prescriptionFormValuesToCreateRequest(values), {
      onSuccess: () => {
        setCreateOpen(false);
        notify('success', 'Prescription created');
      },
      onError: (error) => {
        const info = parseApiError(error);
        // Nested map carries dotted `items.{i}.{field}` keys so 422 errors map
        // to the exact medicine row in the drawer (flat last-segment keys
        // would collide across rows). Top-level `notes` errors appear here too.
        const nested = info.nestedFieldErrors;
        if (info.kind === 'validation' && Object.keys(nested).length > 0) {
          setServerErrors(nested);
        } else {
          setServerMessage(info.message);
        }
      },
    });
  };

  const handleSaveNotes = (notes: string) => {
    if (!notesTarget) return;
    updateMutation.mutate(
      { id: notesTarget.id, payload: prescriptionNotesToUpdateRequest(notes) },
      {
        onSuccess: () => {
          setNotesTarget(null);
          notify('success', 'Prescription notes updated');
        },
        onError: (error) => setServerMessage(parseApiError(error).message),
      },
    );
  };

  const handleCloseNotes = () => {
    setNotesTarget(null);
    setServerMessage(null);
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        notify('success', 'Prescription removed');
      },
      onError: (error) => setServerMessage(parseApiError(error).message),
    });
  };

  const columns: DataTableColumn<PrescriptionListItem>[] = [
    {
      key: 'prescribed_at',
      header: 'Prescribed Date',
      render: (row) => <span className="text-neutral-800">{formatISODate(row.prescribed_at)}</span>,
    },
    {
      key: 'prescribed_by',
      header: 'Prescribed By',
      render: (row) => (
        <span className="text-neutral-700">
          {names.userNames.get(row.prescribed_by) ?? `User #${row.prescribed_by}`}
        </span>
      ),
    },
    {
      key: 'medicine_count',
      header: 'Medicines',
      align: 'center',
      accessor: 'medicine_count',
    },
  ];

  return (
    <Card>
      <Card.Header
        title="Prescriptions"
        actions={
          !isFinalized && items.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setServerErrors({});
                setServerMessage(null);
                setCreateOpen(true);
              }}
              leftIcon={<Icon icon={Plus} size="xs" />}
            >
              New Prescription
            </Button>
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
          ariaLabel="Prescriptions"
          emptyTitle="No prescriptions for this record"
          emptyDescription="Prescribe medicines to start a treatment plan."
          emptyAction={
            !isFinalized ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setServerErrors({});
                  setServerMessage(null);
                  setCreateOpen(true);
                }}
                leftIcon={<Icon icon={Plus} size="xs" />}
              >
                New Prescription
              </Button>
            ) : undefined
          }
          rowActionsHeader=""
          rowActions={(row) =>
            !isFinalized ? (
              <div className="flex items-center justify-end gap-1">
                <IconButton
                  icon={<Icon icon={Pill} size="sm" />}
                  aria-label={`View prescription`}
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewingId(row.id)}
                />
                <IconButton
                  icon={<Icon icon={Pencil} size="sm" />}
                  aria-label="Edit prescription notes"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setServerMessage(null);
                    setNotesTarget(row);
                  }}
                />
                <IconButton
                  icon={<Icon icon={Trash2} size="sm" />}
                  aria-label="Delete prescription"
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

      <PrescriptionCreateDrawer
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setServerErrors({});
          setServerMessage(null);
        }}
        onSubmit={handleCreate}
        submitting={createMutation.isPending}
        serverErrors={serverErrors}
        serverMessage={serverMessage}
      />

      <PrescriptionNotesDialog
        open={notesTarget !== null}
        prescriptionId={notesTarget?.id ?? null}
        submitting={updateMutation.isPending}
        error={serverMessage}
        onSubmit={handleSaveNotes}
        onClose={handleCloseNotes}
      />

      <PrescriptionDeleteConfirm
        open={deleting !== null}
        submitting={deleteMutation.isPending}
        error={serverMessage}
        onConfirm={handleDelete}
        onClose={() => {
          setDeleting(null);
          setServerMessage(null);
        }}
      />

      <PrescriptionViewDrawer
        open={viewingId !== null}
        prescriptionId={viewingId}
        recordId={recordId}
        patientId={patientId}
        patientName={patientName}
        isFinalized={isFinalized}
        prescribedByName={
          viewingId
            ? (names.userNames.get(items.find((p) => p.id === viewingId)?.prescribed_by ?? -1) ??
              null)
            : null
        }
        notify={notify}
        onClose={() => setViewingId(null)}
      />
    </Card>
  );
};
