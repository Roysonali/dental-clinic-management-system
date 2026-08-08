import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientRecordTable } from '../PatientRecordTable';
import { CreateRecordDrawer } from '../dialogs/CreateRecordDrawer';
import { Pagination } from '../../common/Pagination/Pagination';
import { ToastContainer, type Toast } from '../../common/Toast';
import { usePatientRecords } from '../../../hooks/patientRecords/usePatientRecords';
import { usePatientRecordFilters } from '../../../hooks/patientRecords/usePatientRecordFilters';
import { usePatientRecordNames } from '../../../hooks/patientRecords/usePatientRecordNames';
import { useCreatePatientRecord } from '../../../hooks/patientRecords/usePatientRecordMutations';
import { patientRecordService } from '../../../services/patientRecordService';
import { recordFormValuesToCreateRequest } from '../../../utils/patientRecordFormUtils';
import { parseApiError } from '../../../services/apiError';
import { ROUTES } from '../../../routes/routes';
import { PATIENT_RECORD_PAGE_SIZE_OPTIONS } from '../../../constants/patientRecord';
import type { EnrichedPatientRecord, PatientRecordFormValues } from '../../../types/patientRecord';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

/**
 * PatientRecordListContainer — S-01 orchestration ([UI spec S-01]).
 *
 * Owns server-side filters (search/status/finalized — no sort, the backend
 * has none), the list query, patient/appointment name enrichment and the
 * CreateRecordDrawer. A 409 create conflict ("appointment already has a
 * record") surfaces the server message and offers a "View existing record"
 * action resolved through GET /patient-records/appointment/{id} — a real
 * endpoint, never a fabricated id.
 */
export const PatientRecordListContainer: FC = () => {
  const navigate = useNavigate();
  const filters = usePatientRecordFilters();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  const [conflictAppointmentId, setConflictAppointmentId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const recordsQuery = usePatientRecords(filters.params);
  const items = useMemo(() => recordsQuery.data?.items ?? [], [recordsQuery.data?.items]);

  const patientIds = useMemo(
    () => Array.from(new Set(items.map((r) => r.patient_id))).sort(),
    [items],
  );
  const appointmentIds = useMemo(
    () => Array.from(new Set(items.map((r) => r.appointment_id))).sort(),
    [items],
  );
  const names = usePatientRecordNames(patientIds, appointmentIds, []);

  const enriched = useMemo<EnrichedPatientRecord[]>(
    () =>
      items.map((record) => ({
        ...record,
        patient_name: names.patientNames.get(record.patient_id) ?? null,
        appointment_number: names.appointmentNumbers.get(record.appointment_id) ?? null,
      })),
    [items, names],
  );

  /* ── Mutation ─────────────────────────────────────────────────── */
  const createMutation = useCreatePatientRecord();

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `pr-${Date.now()}`, variant, title, description });
  };

  // Auto-dismiss the transient toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleCreate = (values: PatientRecordFormValues) => {
    setCreateError(null);
    setCreateFieldErrors({});
    setConflictAppointmentId(null);
    createMutation.mutate(recordFormValuesToCreateRequest(values), {
      onSuccess: (record) => {
        setCreateOpen(false);
        showToast('success', 'Record created', 'Now add clinical details and diagnoses.');
        navigate(`${ROUTES.PATIENT_RECORDS}/${record.id}`);
      },
      onError: (error) => {
        const info = parseApiError(error);
        if (info.status === 409) {
          // Appointment already has a record (BCR §4.1) — keep the drawer
          // open, show the server message, and offer to open the existing
          // record (resolved via the real by-appointment endpoint).
          setConflictAppointmentId(values.appointment_id);
          setCreateError(info.message);
        } else if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
          setCreateFieldErrors(info.fieldErrors);
        } else {
          setCreateError(info.message);
        }
      },
    });
  };

  const handleViewConflictRecord = async (appointmentId: string) => {
    try {
      const record = await patientRecordService.getRecordByAppointment(appointmentId);
      setCreateOpen(false);
      navigate(`${ROUTES.PATIENT_RECORDS}/${record.id}`);
    } catch {
      // Best-effort: fall back to closing the drawer so the user can retry.
      setCreateOpen(false);
    }
  };

  const totalPages = Math.max(1, recordsQuery.data?.pages ?? 1);
  const queryError = recordsQuery.error ? parseApiError(recordsQuery.error).message : null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <PatientRecordTable
        records={enriched}
        loading={recordsQuery.isLoading}
        error={queryError}
        onRetry={() => void recordsQuery.refetch()}
        onView={(record) => navigate(`${ROUTES.PATIENT_RECORDS}/${record.id}`)}
        onRowClick={(record) => navigate(`${ROUTES.PATIENT_RECORDS}/${record.id}`)}
        searchValue={filters.searchInput}
        onSearchChange={filters.setSearchInput}
        searchLoading={recordsQuery.isFetching && !recordsQuery.isPlaceholderData}
        status={filters.status}
        onStatusChange={filters.setStatus}
        finalized={filters.finalized}
        onFinalizedChange={filters.setFinalized}
        hasActiveFilters={filters.hasActiveFilters}
        onClearFilters={filters.clearFilters}
        onCreate={() => {
          setCreateError(null);
          setCreateFieldErrors({});
          setConflictAppointmentId(null);
          setCreateOpen(true);
        }}
      />

      <Pagination
        currentPage={filters.page}
        totalPages={totalPages}
        onPageChange={filters.setPage}
        totalCount={recordsQuery.data?.total}
        pageSize={filters.pageSize}
        pageSizeSelector={
          <select
            value={filters.pageSize}
            onChange={(e) => filters.setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-8 rounded-lg border border-neutral-300 bg-white px-2 text-caption text-neutral-700 transition-colors duration-150 hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            {PATIENT_RECORD_PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        }
      />

      <CreateRecordDrawer
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
          setCreateFieldErrors({});
          setConflictAppointmentId(null);
        }}
        onSubmit={handleCreate}
        submitting={createMutation.isPending}
        serverErrors={createFieldErrors}
        serverMessage={createError}
        conflictAppointmentId={conflictAppointmentId}
        onViewConflictRecord={handleViewConflictRecord}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
