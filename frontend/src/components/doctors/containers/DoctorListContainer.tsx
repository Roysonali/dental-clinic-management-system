import { useMemo, useState, type FC } from 'react';
import { DoctorTable } from '../DoctorTable';
import { DoctorToolbar } from '../DoctorToolbar';
import { DoctorStatsCards, type DoctorStats } from '../DoctorStatsCards';
import { Pagination } from '../../common/Pagination/Pagination';
import { PageHeader } from '../../common/PageHeader/PageHeader';
import type { ColumnVisibility } from '../../common/DataTable';
import { MobileDoctorList } from '../mobile/MobileDoctorList';
import { MobilePageHeader } from '../../../layouts/components/mobile/MobilePageHeader';
import { MobileBottomNav } from '../../../layouts/components/mobile/MobileBottomNav';
import { useIsMobileViewport } from '../../../hooks/useIsMobileViewport';
import { DoctorFormContainer } from './DoctorFormContainer';
import { DoctorStatusDialog } from '../DoctorStatusDialog';
import type { DoctorStatusIntent } from '../DoctorStatusDialog';
import { useDoctors } from '../../../hooks/doctors/useDoctors';
import { useDoctorFilters } from '../../../hooks/doctors/useDoctorFilters';
import {
  useActivateDoctor,
  useDeactivateDoctor,
} from '../../../hooks/doctors/useDoctorMutations';
import { useSpecializations } from '../../../hooks/doctors/useSpecializations';
import { usePermission } from '../../../hooks/rbac/usePermission';
import { ADMIN_ROLES } from '../../../constants/roles';
import { parseApiError } from '../../../services/apiError';
import { DOCTOR_MAX_PAGE_SIZE } from '../../../constants/doctor';
import type { DoctorResponse } from '../../../types/doctor';

type FormState = { mode: 'create' } | { mode: 'edit'; doctor: DoctorResponse } | null;
type StatusState = { doctor: DoctorResponse; intent: DoctorStatusIntent } | null;

/** Derive the KPI counters from the full roster (no new backend contract). */
function deriveStats(rows: DoctorResponse[] | undefined, total: number | undefined): DoctorStats {
  const items = rows ?? [];
  return {
    total: total ?? items.length,
    active: items.filter((d) => d.is_active).length,
    available: items.filter((d) => d.is_active && d.available_for_appointment && !d.on_leave).length,
    onLeave: items.filter((d) => d.on_leave).length,
  };
}

/**
 * DoctorListContainer — orchestrates the doctor list page.
 *
 * Owns the query state (search/filters/pagination via useDoctorFilters +
 * useDoctors), the specialization filter options, the KPI stats, the
 * create/edit drawer, and the activate/deactivate dialogs. All filtering
 * is backend-driven (`GET /doctors` query params) — no client-side
 * filtering.
 */
export const DoctorListContainer: FC = () => {
  const isMobile = useIsMobileViewport();
  const filters = useDoctorFilters();
  const doctorsQuery = useDoctors(filters.params);
  const specializationsQuery = useSpecializations({ page_size: DOCTOR_MAX_PAGE_SIZE });

  // Separate query for the KPI cards — same `GET /doctors` contract, larger
  // page size so the counts reflect the whole roster (shares the query key
  // namespace; distinct params → distinct cache entry).
  const statsQuery = useDoctors({ page: 1, page_size: DOCTOR_MAX_PAGE_SIZE });
  const stats = useMemo(
    () => deriveStats(statsQuery.data?.items, statsQuery.data?.total),
    [statsQuery.data],
  );

  const [formState, setFormState] = useState<FormState>(null);
  const [statusState, setStatusState] = useState<StatusState>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({});

  const activateMutation = useActivateDoctor();
  const deactivateMutation = useDeactivateDoctor();
  const statusSubmitting = activateMutation.isPending || deactivateMutation.isPending;

  // Activate/deactivate are ADMIN-only on the backend (require_roles([ADMIN]))
  // — hide the row actions for everyone else (Sprint 11C). Edit/create stay
  // visible: they allow ADMIN + RECEPTIONIST, which the client cannot
  // distinguish, so the backend enforces those.
  const { can } = usePermission();
  const canManageStatus = can(ADMIN_ROLES);

  const queryError = doctorsQuery.error ? parseApiError(doctorsQuery.error).message : null;

  const totalPages = Math.max(1, Math.ceil((doctorsQuery.data?.total ?? 0) / filters.pageSize));

  const hasActiveFilters =
    filters.searchInput.trim() !== '' ||
    filters.status !== 'all' ||
    filters.availability !== 'all' ||
    filters.specializationId !== null;
  const clearFilters = () => {
    filters.setSearchInput('');
    filters.setStatus('all');
    filters.setAvailability('all');
    filters.setSpecialization(null);
    filters.setPage(1);
  };

  const openCreate = () => setFormState({ mode: 'create' });
  const openEdit = (doctor: DoctorResponse) => setFormState({ mode: 'edit', doctor });
  const closeForm = () => setFormState(null);

  const handleStatusConfirm = () => {
    if (!statusState) return;
    setStatusError(null);
    const { doctor, intent } = statusState;
    const mutation = intent === 'deactivate' ? deactivateMutation : activateMutation;
    mutation.mutate(doctor.id, {
      onSuccess: () => setStatusState(null),
      onError: (error) => setStatusError(parseApiError(error).message),
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 sm:gap-6">
      {isMobile ? (
        <>
          <MobilePageHeader
            title="Doctors"
            addLabel="Register doctor"
            onAdd={openCreate}
          />
          <MobileDoctorList
            doctors={doctorsQuery.data?.items ?? []}
            loading={doctorsQuery.isLoading}
            error={queryError}
            onRetry={() => void doctorsQuery.refetch()}
            searchValue={filters.searchInput}
            onSearchChange={filters.setSearchInput}
            status={filters.status}
            onStatusChange={filters.setStatus}
            availability={filters.availability}
            onAvailabilityChange={filters.setAvailability}
            specializations={specializationsQuery.data?.items ?? []}
            specializationId={filters.specializationId}
            onSpecializationChange={filters.setSpecialization}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            onView={openEdit}
            page={filters.page}
            totalPages={totalPages}
            totalCount={doctorsQuery.data?.total}
            pageSize={filters.pageSize}
            onPageChange={filters.setPage}
            onPageSizeChange={filters.setPageSize}
          />
          <MobileBottomNav />
        </>
      ) : (
        <>
      <PageHeader
        title="Doctors"
        subtitle="Search, filter and manage doctor records."
      />

      <DoctorStatsCards stats={stats} loading={statsQuery.isLoading} />

      {/* Single page-level toolbar: search + columns + Register Doctor +
          compact filter chips. Owned here so the DataTable never renders
          its own toolbar. */}
      <DoctorToolbar
        searchValue={filters.searchInput}
        onSearchChange={filters.setSearchInput}
        searchLoading={doctorsQuery.isFetching && !doctorsQuery.isPlaceholderData}
        status={filters.status}
        onStatusChange={filters.setStatus}
        availability={filters.availability}
        onAvailabilityChange={filters.setAvailability}
        specializations={specializationsQuery.data?.items ?? []}
        specializationId={filters.specializationId}
        onSpecializationChange={filters.setSpecialization}
        onRegister={openCreate}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />

      <DoctorTable
        doctors={doctorsQuery.data?.items ?? []}
        loading={doctorsQuery.isLoading}
        error={queryError}
        onRetry={() => void doctorsQuery.refetch()}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        onEdit={openEdit}
        onDeactivate={canManageStatus ? (doctor) => setStatusState({ doctor, intent: 'deactivate' }) : undefined}
        onReactivate={canManageStatus ? (doctor) => setStatusState({ doctor, intent: 'activate' }) : undefined}
      />

      <Pagination
        currentPage={filters.page}
        totalPages={totalPages}
        onPageChange={filters.setPage}
        totalCount={doctorsQuery.data?.total}
        pageSize={filters.pageSize}
      />
        </>
      )}

      <DoctorFormContainer
        key={formState?.mode === 'edit' ? formState.doctor.id : 'create'}
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        doctorId={formState?.mode === 'edit' ? formState.doctor.id : null}
        onClose={closeForm}
      />

      <DoctorStatusDialog
        open={statusState !== null}
        doctor={statusState?.doctor ?? null}
        intent={statusState?.intent ?? null}
        submitting={statusSubmitting}
        error={statusError}
        onConfirm={handleStatusConfirm}
        onClose={() => {
          setStatusState(null);
          setStatusError(null);
        }}
      />
    </div>
  );
};
