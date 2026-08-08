import { useState, type FC } from 'react';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '../../common/Drawer/Drawer';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Button } from '../../common/Button/Button';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Spinner } from '../../common/Spinner/Spinner';
import { ResultState } from '../../common/ResultState/ResultState';
import { ItemFormDialog } from './ItemFormDialog';
import { ItemDeleteConfirm } from './ItemDeleteConfirm';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientRecordQueryKeys } from '../../../hooks/patientRecords/patientRecordQueryKeys';
import {
  useCreatePrescriptionItem,
  useDeletePrescriptionItem,
  useUpdatePrescriptionItem,
} from '../../../hooks/patientRecords/usePatientRecordChildMutations';
import {
  prescriptionItemFormValuesToRequest,
  prescriptionItemFormValuesToUpdateRequest,
} from '../../../utils/patientRecordFormUtils';
import { parseApiError } from '../../../services/apiError';
import { formatISODate } from '../../../utils/date';
import type {
  PrescriptionItemFormValues,
  PrescriptionItemResponse,
} from '../../../types/patientRecord';

interface PrescriptionViewDrawerProps {
  open: boolean;
  prescriptionId: string | null;
  /** Parent record id — item mutations invalidate the record aggregate too. */
  recordId: string;
  isFinalized: boolean;
  /** Resolved prescriber name ("User #id" fallback is done by the tab). */
  prescribedByName: string | null;
  notify: (variant: 'success', title: string, description?: string) => void;
  onClose: () => void;
}

/**
 * PrescriptionViewDrawer — S-11 prescription items management ([UI spec S-11]).
 *
 * Fetches the full prescription (`GET /prescriptions/{id}` — the list rows
 * don't carry notes/instructions) and renders the items table (oldest
 * first, per backend). Item CRUD via the dedicated item endpoints. No
 * print/approval/refill — the backend has none.
 */
export const PrescriptionViewDrawer: FC<PrescriptionViewDrawerProps> = ({
  open,
  prescriptionId,
  recordId,
  isFinalized,
  prescribedByName,
  notify,
  onClose,
}) => {
  const prescriptionQuery = useQuery({
    queryKey: patientRecordQueryKeys.prescription(prescriptionId ?? ''),
    queryFn: () => patientRecordService.getPrescription(prescriptionId as string),
    enabled: open && prescriptionId != null,
  });
  const prescription = prescriptionQuery.data;

  const createMutation = useCreatePrescriptionItem(prescriptionId ?? '', recordId);
  const updateMutation = useUpdatePrescriptionItem(prescriptionId ?? '', recordId);
  const deleteMutation = useDeletePrescriptionItem(prescriptionId ?? '', recordId);

  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrescriptionItemResponse | null>(null);
  const [deletingItem, setDeletingItem] = useState<PrescriptionItemResponse | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const items = prescription?.items ?? [];

  const handleError = (error: Error) => {
    const info = parseApiError(error);
    if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
      setServerErrors(info.fieldErrors);
    } else {
      setServerMessage(info.message);
    }
  };

  const handleItemSubmit = (values: PrescriptionItemFormValues) => {
    setServerErrors({});
    setServerMessage(null);
    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, payload: prescriptionItemFormValuesToUpdateRequest(values, editingItem) },
        {
          onSuccess: () => {
            setItemFormOpen(false);
            notify('success', 'Medicine updated');
          },
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(prescriptionItemFormValuesToRequest(values), {
        onSuccess: () => {
          setItemFormOpen(false);
          notify('success', 'Medicine added');
        },
        onError: handleError,
      });
    }
  };

  const handleDeleteItem = () => {
    if (!deletingItem) return;
    deleteMutation.mutate(deletingItem.id, {
      onSuccess: () => {
        setDeletingItem(null);
        notify('success', 'Medicine removed');
      },
      onError: (error) => setServerMessage(parseApiError(error).message),
    });
  };

  const columns: DataTableColumn<PrescriptionItemResponse>[] = [
    { key: 'medicine_name', header: 'Medicine', render: (row) => <span className="font-medium text-neutral-900">{row.medicine_name}</span> },
    { key: 'dosage', header: 'Dosage', accessor: 'dosage' },
    { key: 'frequency', header: 'Frequency', accessor: 'frequency' },
    { key: 'duration', header: 'Duration', accessor: 'duration' },
    { key: 'instructions', header: 'Instructions', render: (row) => <span className="block max-w-[220px] truncate text-neutral-600" title={row.instructions ?? ''}>{row.instructions || '—'}</span> },
  ];

  return (
    <Drawer open={open} onClose={onClose} position="right" size="lg" ariaLabel="Prescription details">
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">Prescription</h2>
            <p className="text-caption text-neutral-500">
              {prescription
                ? `Prescribed ${formatISODate(prescription.prescribed_at)} · ${prescribedByName ?? `User #${prescription.prescribed_by}`}`
                : 'Loading…'}
            </p>
          </div>
          <IconButton
            icon={<Icon icon={X} size="sm" />}
            aria-label="Close"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
      </Drawer.Header>

      <Drawer.Body>
        {prescriptionQuery.isPending && (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-400" role="status">
            <Spinner size="sm" variant="neutral" /> Loading prescription…
          </div>
        )}

        {prescriptionQuery.isError && (
          <ResultState
            variant="error"
            title="Prescription unavailable"
            description={prescriptionQuery.error ? parseApiError(prescriptionQuery.error).message : 'Could not load this prescription.'}
            actions={<Button variant="primary" onClick={() => void prescriptionQuery.refetch()}>Retry</Button>}
          />
        )}

        {prescription && (
          <div className="flex flex-col gap-4">
            {prescription.notes && (
              <div className="rounded-lg bg-neutral-50 p-3">
                <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-body text-neutral-800">
                  {prescription.notes}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-label font-medium text-neutral-700">
                Medicines ({items.length})
              </span>
              {!isFinalized && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setServerErrors({});
                    setServerMessage(null);
                    setEditingItem(null);
                    setItemFormOpen(true);
                  }}
                  leftIcon={<Icon icon={Plus} size="xs" />}
                >
                  Add Medicine
                </Button>
              )}
            </div>

            <DataTable
              columns={columns}
              data={items}
              rowKey={(row) => row.id}
              loading={false}
              ariaLabel="Prescription medicines"
              emptyTitle="No medicines"
              emptyDescription="Add medicines to this prescription."
              rowActionsHeader=""
              rowActions={(row) =>
                !isFinalized ? (
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      icon={<Icon icon={Pencil} size="sm" />}
                      aria-label={`Edit medicine ${row.medicine_name}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setServerErrors({});
                        setServerMessage(null);
                        setEditingItem(row);
                        setItemFormOpen(true);
                      }}
                    />
                    <IconButton
                      icon={<Icon icon={Trash2} size="sm" />}
                      aria-label={`Delete medicine ${row.medicine_name}`}
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger/10"
                      onClick={() => {
                        setServerMessage(null);
                        setDeletingItem(row);
                      }}
                    />
                  </div>
                ) : undefined
              }
            />
          </div>
        )}
      </Drawer.Body>

      <ItemFormDialog
        open={itemFormOpen}
        item={editingItem}
        submitting={createMutation.isPending || updateMutation.isPending}
        serverErrors={serverErrors}
        serverMessage={serverMessage}
        onSubmit={handleItemSubmit}
        onClose={() => setItemFormOpen(false)}
      />

      <ItemDeleteConfirm
        open={deletingItem !== null}
        medicineName={deletingItem?.medicine_name ?? null}
        submitting={deleteMutation.isPending}
        error={serverMessage}
        onConfirm={handleDeleteItem}
        onClose={() => {
          setDeletingItem(null);
          setServerMessage(null);
        }}
      />
    </Drawer>
  );
};
