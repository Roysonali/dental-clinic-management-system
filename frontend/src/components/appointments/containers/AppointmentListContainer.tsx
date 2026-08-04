import { useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppointmentTable } from '../AppointmentTable';
import { AppointmentFormContainer } from './AppointmentFormContainer';
import { CancelAppointmentDialog } from '../CancelAppointmentDialog';
import { Pagination } from '../../common/Pagination/Pagination';
import { APPOINTMENT_PAGE_SIZE_OPTIONS } from '../../../constants/appointment';
import { useAppointments } from '../../../hooks/appointments/useAppointments';
import { useAppointmentFilters } from '../../../hooks/appointments/useAppointmentFilters';
import { useAppointmentNames } from '../../../hooks/appointments/useAppointmentNames';
import { useCancelAppointment } from '../../../hooks/appointments/useAppointmentMutations';
import { apiErrorMessage, parseApiError } from '../../../services/apiError';
import { formatISODate, formatTimeRange } from '../../../utils/date';
import { ROUTES } from '../../../routes/routes';
import type { EnrichedAppointment } from '../../../types/appointment';

type FormState = { mode: 'create' } | { mode: 'edit'; appointment: EnrichedAppointment } | null;
type CancelState = { appointment: EnrichedAppointment } | null;

/**
 * AppointmentListContainer — orchestrates the appointment list page.
 *
 * Owns the query state (debounced search / status filter / pagination via
 * `useAppointmentFilters`), fetches the list via `useAppointments`, and
 * enriches each row with patient/dentist display names via
 * `useAppointmentNames`. Also owns the create/edit drawer and the cancel
 * confirmation dialog. Presentational components (AppointmentTable /
 * Pagination) stay dumb.
 *
 * NOTE: GET /appointments supports only `skip`/`limit` — there is no
 * server-side search or status filter — so search/status are applied
 * client-side over the current page's enriched rows (mirroring the Patient
 * toolbar UX without touching the backend contract).
 */
export const AppointmentListContainer: FC = () => {
  const navigate = useNavigate();

  const filters = useAppointmentFilters();
  const [formState, setFormState] = useState<FormState>(null);
  const [cancelState, setCancelState] = useState<CancelState>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelMutation = useCancelAppointment();

  const appointmentsQuery = useAppointments(filters.params);
  const items = useMemo(
    () => appointmentsQuery.data?.items ?? [],
    [appointmentsQuery.data?.items],
  );

  const patientIds = useMemo(
    () => Array.from(new Set(items.map((a) => a.patient_id))).sort(),
    [items],
  );
  const dentistIds = useMemo(
    () => Array.from(new Set(items.map((a) => a.dentist_id))).sort((a, b) => a - b),
    [items],
  );

  const names = useAppointmentNames(patientIds, dentistIds);

  const enriched = useMemo<EnrichedAppointment[]>(
    () =>
      items.map((a) => ({
        ...a,
        patient_name: names.data?.patientNames.get(a.patient_id) ?? null,
        dentist_name: names.data?.dentistNames.get(a.dentist_id) ?? null,
      })),
    [items, names.data],
  );

  /* ── Client-side search + status filtering (backend has no filter params) ── */
  const visibleRows = useMemo(() => {
    const query = filters.debouncedSearch.trim().toLowerCase();
    return enriched.filter((a) => {
      if (filters.status !== 'all' && a.status !== filters.status) return false;
      if (!query) return true;
      const haystack = [
        a.appointment_number,
        a.patient_name ?? `Patient #${a.patient_id}`,
        a.dentist_name ?? `Dentist #${a.dentist_id}`,
        a.appointment_type,
        a.status,
        formatISODate(a.appointment_date),
        formatTimeRange(a.start_time, a.end_time),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [enriched, filters.debouncedSearch, filters.status]);

  const total = appointmentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const queryError = appointmentsQuery.error
    ? apiErrorMessage(appointmentsQuery.error)
    : null;
  const namesLoading = names.isLoading && items.length > 0;

  // Client-side filtering only ever sees the current backend page, so the
  // footer pagination (summary + page controls + rows-per-page) is hidden
  // while a search/status filter is active — otherwise the total would be
  // misleading and paging would silently re-filter the next page's data.
  const isFilterActive =
    filters.debouncedSearch.trim() !== '' || filters.status !== 'all';

  const openCreate = () => setFormState({ mode: 'create' });
  const openEdit = (appointment: EnrichedAppointment) =>
    setFormState({ mode: 'edit', appointment });
  const closeForm = () => setFormState(null);

  const handleCancelConfirm = () => {
    if (!cancelState) return;
    setCancelError(null);
    cancelMutation.mutate(cancelState.appointment.id, {
      onSuccess: () => setCancelState(null),
      onError: (error) => setCancelError(parseApiError(error).message),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <AppointmentTable
        appointments={visibleRows}
        namesLoading={namesLoading}
        loading={appointmentsQuery.isLoading}
        error={queryError}
        onRetry={() => void appointmentsQuery.refetch()}
        searchValue={filters.searchInput}
        onSearchChange={filters.setSearchInput}
        searchLoading={appointmentsQuery.isFetching && !appointmentsQuery.isPlaceholderData}
        statusFilter={filters.status}
        onStatusFilterChange={filters.setStatus}
        onCreate={openCreate}
        onView={(appointment) => navigate(`${ROUTES.APPOINTMENTS}/${appointment.id}`)}
        onEdit={openEdit}
        onCancel={(appointment) => {
          setCancelError(null);
          setCancelState({ appointment });
        }}
        onRowClick={(appointment) => navigate(`${ROUTES.APPOINTMENTS}/${appointment.id}`)}
      />

      {!isFilterActive && (
        <Pagination
          currentPage={filters.page}
          totalPages={totalPages}
          onPageChange={filters.setPage}
          totalCount={total}
          pageSize={filters.pageSize}
          pageSizeSelector={
            <select
              value={filters.pageSize}
              onChange={(e) => filters.setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="
                h-8 rounded-lg border border-neutral-300 bg-white px-2 text-caption text-neutral-700
                transition-colors duration-150 hover:border-neutral-400
                focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20
              "
            >
              {APPOINTMENT_PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          }
        />
      )}

      <AppointmentFormContainer
        key={formState?.mode === 'edit' ? formState.appointment.id : 'create'}
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        appointmentId={formState?.mode === 'edit' ? formState.appointment.id : null}
        onClose={closeForm}
        onCreated={(appointment) => navigate(`${ROUTES.APPOINTMENTS}/${appointment.id}`)}
      />

      <CancelAppointmentDialog
        open={cancelState !== null}
        appointment={cancelState?.appointment ?? null}
        submitting={cancelMutation.isPending}
        error={cancelError}
        onConfirm={handleCancelConfirm}
        onClose={() => {
          setCancelState(null);
          setCancelError(null);
        }}
      />
    </div>
  );
};
