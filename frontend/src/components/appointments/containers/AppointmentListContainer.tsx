import { useMemo, useState, type FC } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppointmentTable } from '../AppointmentTable';
import { AppointmentFormContainer } from './AppointmentFormContainer';
import { CancelAppointmentDialog } from '../CancelAppointmentDialog';
import { Pagination } from '../../common/Pagination/Pagination';
import { MobileAppointmentList } from '../mobile/MobileAppointmentList';
import { MobilePageHeader } from '../../../layouts/components/mobile/MobilePageHeader';
import { MobileBottomNav } from '../../../layouts/components/mobile/MobileBottomNav';
import { useIsMobileViewport } from '../../../hooks/useIsMobileViewport';
import { APPOINTMENT_PAGE_SIZE_OPTIONS } from '../../../constants/appointment';
import { useAppointments } from '../../../hooks/appointments/useAppointments';
import { useAppointmentFilters } from '../../../hooks/appointments/useAppointmentFilters';
import { useCancelAppointment } from '../../../hooks/appointments/useAppointmentMutations';
import { apiErrorMessage, parseApiError } from '../../../services/apiError';
import { ROUTES, CREATE_QUERY_PARAM } from '../../../routes/routes';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobileViewport();

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

  // Backend now returns patient_name and dentist_name via eager-loaded
  // relationships, eliminating N+1 API calls. Map them into EnrichedAppointment.
  const enriched = useMemo<EnrichedAppointment[]>(
    () =>
      items.map((a) => ({
        ...a,
        patient_name: a.patient_name ?? null,
        dentist_name: a.dentist_name ?? null,
      })),
    [items],
  );

  // Server-side filtering: the backend handles search/status/date filters,
  // so no client-side filtering is needed.
  const visibleRows = enriched;

  const total = appointmentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const queryError = appointmentsQuery.error
    ? apiErrorMessage(appointmentsQuery.error)
    : null;

  // Server-side filtering: pagination always reflects the full filtered
  // dataset, so pagination controls are always visible.
  const isFilterActive = false;

  const clearFilters = () => {
    filters.setSearchInput('');
    filters.setStatus('all');
    filters.setPage(1);
  };

  // Dashboard "Schedule Appointment" CTA deep-links to
  // /appointments?create=true so the create drawer opens on the first render
  // (mirrors the invoice list's create-intent handoff). The intent is
  // stripped with `replace` when the form closes so the URL never re-opens
  // the drawer.
  const createRequested = searchParams.get(CREATE_QUERY_PARAM) === 'true';
  const createPatientId = searchParams.get('patientId');

  const openCreate = () => setFormState({ mode: 'create' });
  const openEdit = (appointment: EnrichedAppointment) =>
    setFormState({ mode: 'edit', appointment });
  const closeForm = () => {
    setFormState(null);
    if (createRequested) {
      const next = new URLSearchParams(searchParams);
      next.delete(CREATE_QUERY_PARAM);
      next.delete('patientId');
      setSearchParams(next, { replace: true });
    }
  };

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
      {isMobile ? (
        <>
          <MobilePageHeader
            title="Appointments"
            addLabel="Book appointment"
            onAdd={openCreate}
          />
          <MobileAppointmentList
            appointments={visibleRows}
            loading={appointmentsQuery.isLoading}
            error={queryError}
            onRetry={() => void appointmentsQuery.refetch()}
            searchValue={filters.searchInput}
            onSearchChange={filters.setSearchInput}
            status={filters.status}
            onStatusChange={filters.setStatus}
            hasActiveFilters={isFilterActive}
            onClearFilters={clearFilters}
            onView={(appointment) => navigate(`${ROUTES.APPOINTMENTS}/${appointment.id}`)}
            page={filters.page}
            totalPages={isFilterActive ? 0 : totalPages}
            totalCount={total}
            pageSize={filters.pageSize}
            onPageChange={filters.setPage}
            onPageSizeChange={filters.setPageSize}
          />
          <MobileBottomNav />
        </>
      ) : (
        <>
          <AppointmentTable
            appointments={visibleRows}
            namesLoading={false}
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
        </>
      )}

      <AppointmentFormContainer
        key={formState?.mode === 'edit' ? formState.appointment.id : 'create'}
        open={createRequested || formState !== null}
        mode={formState?.mode ?? 'create'}
        appointmentId={formState?.mode === 'edit' ? formState.appointment.id : null}
        patientId={createPatientId}
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
