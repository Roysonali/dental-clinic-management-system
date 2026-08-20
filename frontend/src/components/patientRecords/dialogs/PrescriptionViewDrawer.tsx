import { useState, type FC } from 'react';
import { X, Plus, Pencil, Trash2, Download, Printer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '../../common/Drawer/Drawer';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Button } from '../../common/Button/Button';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Spinner } from '../../common/Spinner/Spinner';
import { ResultState } from '../../common/ResultState/ResultState';
import { PrintDocumentDialog } from '../../common/PrintDocument';
import { PrescriptionDocument } from '../PrescriptionDocument';
import { ItemFormDialog } from './ItemFormDialog';
import { ItemDeleteConfirm } from './ItemDeleteConfirm';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientService } from '../../../services/patientService';
import { patientRecordQueryKeys } from '../../../hooks/patientRecords/patientRecordQueryKeys';
import { patientQueryKeys } from '../../../hooks/patients/usePatients';
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
  /** Parent record's patient id — patient display data for the printable document. */
  patientId: string | null;
  /** Resolved patient display name ("Patient #…" fallback is done by the document). */
  patientName: string | null;
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
  patientId,
  patientName,
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

  // Patient display data for the printable document — shares the exact
  // cache key the record page's name resolution already populates, so no
  // extra network call when the page has resolved the patient.
  const patientQuery = useQuery({
    queryKey: patientQueryKeys.detail(patientId ?? ''),
    queryFn: () => patientService.get(patientId as string),
    enabled: open && patientId != null,
  });
  const patient = patientQuery.data;

  const [printOpen, setPrintOpen] = useState(false);

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
    {
      key: 'medicine_name',
      header: 'Medicine',
      render: (row) => (
        <span className="block max-w-[180px] truncate font-medium text-neutral-900" title={row.medicine_name}>
          {row.medicine_name}
        </span>
      ),
    },
    { key: 'dosage', header: 'Dosage', accessor: 'dosage' },
    { key: 'frequency', header: 'Frequency', accessor: 'frequency' },
    { key: 'duration', header: 'Duration', accessor: 'duration' },
    {
      key: 'instructions',
      header: 'Instructions',
      render: (row) => (
        <span className="block max-w-[180px] truncate text-neutral-600" title={row.instructions ?? ''}>
          {row.instructions || '—'}
        </span>
      ),
    },
  ];

  return (
    <Drawer open={open} onClose={onClose} position="right" size="lg" ariaLabel="Prescription details">
      <Drawer.Header>
        <div className="flex w-full flex-col gap-3">
          {/* Title + metadata row. The drawer control (Close) sits at the
              far-right edge — the established DensCare Drawer pattern
              ([Title] … [Close]) — so it never reads as a document action. */}
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
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
              title="Close"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>

          {/* Document actions — grouped together in their own row, clearly
              separate from the drawer control, so they read as actions ON
              the prescription document. */}
          {prescription && (
            <div
              role="group"
              aria-label="Document actions"
              className="flex flex-wrap items-center gap-2"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintOpen(true)}
                leftIcon={<Icon icon={Printer} size="xs" />}
              >
                Print
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPrintOpen(true)}
                leftIcon={<Icon icon={Download} size="xs" />}
                title="Opens the print dialog — choose “Save as PDF” to download"
              >
                Download PDF
              </Button>
            </div>
          )}
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

      {/* Printable prescription — preview + print/download surface (Task 4) */}
      <PrintDocumentDialog
        open={printOpen}
        title="Prescription"
        documentType="Prescription"
        onClose={() => setPrintOpen(false)}
      >
        {prescription && (
          <PrescriptionDocument
            prescription={prescription}
            patientName={patientName ?? (patient?.full_name ?? null)}
            patientCode={patient?.patient_code ?? null}
            patientAge={patient?.age ?? null}
            patientGender={patient?.gender ?? null}
            patientDOB={patient?.date_of_birth ?? null}
            prescriberName={prescribedByName}
          />
        )}
      </PrintDocumentDialog>

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
