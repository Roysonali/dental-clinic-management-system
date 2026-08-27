import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TreatmentPlanTable } from '../TreatmentPlanTable';
import { TreatmentPlanToolbar } from '../TreatmentPlanToolbar';
import { TreatmentPlanSummaryCards } from '../TreatmentPlanSummaryCards';
import { CreatePlanDrawer } from '../dialogs/CreatePlanDrawer';
import { Pagination } from '../../common/Pagination/Pagination';
import { ToastContainer, type Toast } from '../../common/Toast';
import { MobileTreatmentPlanList } from '../mobile/MobileTreatmentPlanList';
import { MobilePageHeader } from '../../../layouts/components/mobile/MobilePageHeader';
import { MobileBottomNav } from '../../../layouts/components/mobile/MobileBottomNav';
import { useIsMobileViewport } from '../../../hooks/useIsMobileViewport';
import { useTreatmentPlans } from '../../../hooks/treatmentPlans/useTreatmentPlans';
import { useTreatmentPlanFilters } from '../../../hooks/treatmentPlans/useTreatmentPlanFilters';
import { useTreatmentPlanNames } from '../../../hooks/treatmentPlans/useTreatmentPlanNames';
import { useTreatmentDashboard } from '../../../hooks/treatmentPlans/useTreatmentDashboard';
import { useDoctors } from '../../../hooks/doctors/useDoctors';
import { useCreateTreatmentPlan } from '../../../hooks/treatmentPlans/useTreatmentPlanMutations';
import { usePatient } from '../../../hooks/patients/usePatient';
import { planFormValuesToRequest } from '../treatmentPlanFormUtils';
import { parseApiError } from '../../../services/apiError';
import { ROUTES, CREATE_QUERY_PARAM } from '../../../routes/routes';
import { TREATMENT_PLAN_PAGE_SIZE_OPTIONS } from '../../../constants/treatmentPlan';
import type { EnrichedTreatmentPlan } from '../../../types/treatmentPlan';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

/**
 * TreatmentPlanListContainer — S-01 orchestration ([MAP §3.1]).
 *
 * Owns server-side filters, the list + dashboard queries, patient/doctor
 * name enrichment and the CreatePlanDrawer. Status transitions are NOT
 * surfaced here — they live on the detail page (S-02) where the full plan
 * aggregate and action bar render. Mutations invalidate the
 * `['treatment-plans']` root on success (React Query contract §9).
 */
export const TreatmentPlanListContainer: FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobileViewport();
  const filters = useTreatmentPlanFilters();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast | null>(null);

  // Deep-link from Patient Hub: ?create=true&patientId={id}
  const createRequested = searchParams.get(CREATE_QUERY_PARAM) === 'true';
  const createPatientId = searchParams.get('patientId');

  // Fetch patient details for human-readable label when deep-linked.
  const patientQuery = usePatient(createPatientId, !!createPatientId);
  const selectedPatientLabel = patientQuery.data
    ? `${patientQuery.data.full_name} (${patientQuery.data.patient_code})`
    : null;

  const openCreate = () => {
    setCreateError(null);
    setCreateFieldErrors({});
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    setCreateFieldErrors({});
    if (createRequested) {
      const next = new URLSearchParams(searchParams);
      next.delete(CREATE_QUERY_PARAM);
      next.delete('patientId');
      setSearchParams(next, { replace: true });
    }
  };

  // Auto-open the drawer when deep-linked with ?create=true
  useEffect(() => {
    if (createRequested && !createOpen) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const plansQuery = useTreatmentPlans(filters.params);
  const dashboardQuery = useTreatmentDashboard();
  const doctorsQuery = useDoctors(); // active doctors, 5-min cache (dropdown)

  const items = useMemo(() => plansQuery.data?.items ?? [], [plansQuery.data?.items]);

  const patientIds = useMemo(
    () => Array.from(new Set(items.map((p) => p.patient_id))).sort(),
    [items],
  );
  const doctorIds = useMemo(
    () => Array.from(new Set(items.map((p) => p.doctor_id))).sort(),
    [items],
  );
  const names = useTreatmentPlanNames(patientIds, doctorIds);

  const enriched = useMemo<EnrichedTreatmentPlan[]>(
    () =>
      items.map((plan) => ({
        ...plan,
        patient_name: names.data?.patientNames.get(plan.patient_id) ?? null,
        doctor_name: names.data?.doctorNames.get(plan.doctor_id) ?? null,
      })),
    [items, names.data],
  );

  /* ── Mutation ─────────────────────────────────────────────────── */
  const createMutation = useCreateTreatmentPlan();

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `tp-${Date.now()}`, variant, title, description });
  };

  // Auto-dismiss the transient toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleCreate = (values: Parameters<typeof planFormValuesToRequest>[0]) => {
    setCreateError(null);
    setCreateFieldErrors({});
    createMutation.mutate(planFormValuesToRequest(values), {
      onSuccess: (plan) => {
        closeCreate();
        showToast('success', `Plan ${plan.plan_code} created`, 'Now add items to the plan.');
        navigate(`${ROUTES.TREATMENT_PLANS}/${plan.id}`);
      },
      onError: (error) => {
        const info = parseApiError(error);
        if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
          setCreateFieldErrors(info.fieldErrors);
        } else {
          setCreateError(info.message);
        }
      },
    });
  };

  const doctorOptions = useMemo(
    () =>
      (doctorsQuery.data?.items ?? []).map((d) => ({
        value: d.id,
        label: d.user_full_name ?? `Doctor #${d.id}`,
      })),
    [doctorsQuery.data?.items],
  );

  const totalPages = Math.max(1, plansQuery.data?.total_pages ?? 1);
  const queryError = plansQuery.error ? parseApiError(plansQuery.error).message : null;

  return (
    <div className="flex flex-col gap-4">
      {isMobile ? (
        <>
          <MobilePageHeader
            title="Treatment Plans"
            addLabel="New treatment plan"
            onAdd={openCreate}
          />
          <MobileTreatmentPlanList
            plans={enriched}
            loading={plansQuery.isLoading}
            error={queryError}
            onRetry={() => void plansQuery.refetch()}
            searchValue={filters.searchInput}
            onSearchChange={filters.setSearchInput}
            status={filters.status}
            onStatusChange={filters.setStatus}
            active={filters.active}
            onActiveChange={filters.setActive}
            doctorId={filters.doctorId}
            onDoctorChange={filters.setDoctorId}
            doctorOptions={doctorOptions}
            doctorsLoading={doctorsQuery.isLoading}
            dateFrom={filters.dateFrom}
            onDateFromChange={filters.setDateFrom}
            dateTo={filters.dateTo}
            onDateToChange={filters.setDateTo}
            sortBy={filters.sortBy}
            onSortByChange={filters.setSortBy}
            sortOrder={filters.sortOrder}
            onSortOrderChange={filters.setSortOrder}
            hasActiveFilters={filters.hasActiveFilters}
            onClearFilters={filters.clearFilters}
            onView={(plan) => navigate(`${ROUTES.TREATMENT_PLANS}/${plan.id}`)}
            page={filters.page}
            totalPages={totalPages}
            totalCount={plansQuery.data?.total}
            pageSize={filters.pageSize}
            onPageChange={filters.setPage}
            onPageSizeChange={filters.setPageSize}
          />
          <MobileBottomNav />
        </>
      ) : (
        <>
      <TreatmentPlanSummaryCards
        dashboard={dashboardQuery.data}
        loading={dashboardQuery.isLoading}
      />

      <TreatmentPlanToolbar
        searchValue={filters.searchInput}
        onSearchChange={filters.setSearchInput}
        searchLoading={plansQuery.isFetching && !plansQuery.isPlaceholderData}
        status={filters.status}
        onStatusChange={filters.setStatus}
        active={filters.active}
        onActiveChange={filters.setActive}
        doctorId={filters.doctorId}
        onDoctorChange={filters.setDoctorId}
        doctorOptions={doctorOptions}
        doctorsLoading={doctorsQuery.isLoading}
        dateFrom={filters.dateFrom}
        onDateFromChange={filters.setDateFrom}
        dateTo={filters.dateTo}
        onDateToChange={filters.setDateTo}
        sortBy={filters.sortBy}
        onSortByChange={filters.setSortBy}
        sortOrder={filters.sortOrder}
        onSortOrderChange={filters.setSortOrder}
        hasActiveFilters={filters.hasActiveFilters}
        onClearFilters={filters.clearFilters}
        onCreate={openCreate}
      />

      <TreatmentPlanTable
        plans={enriched}
        loading={plansQuery.isLoading}
        error={queryError}
        onRetry={() => void plansQuery.refetch()}
        onView={(plan) => navigate(`${ROUTES.TREATMENT_PLANS}/${plan.id}`)}
        onRowClick={(plan) => navigate(`${ROUTES.TREATMENT_PLANS}/${plan.id}`)}
      />

      <Pagination
        currentPage={filters.page}
        totalPages={totalPages}
        onPageChange={filters.setPage}
        totalCount={plansQuery.data?.total}
        pageSize={filters.pageSize}
        pageSizeSelector={
          <select
            value={filters.pageSize}
            onChange={(e) => filters.setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-8 rounded-lg border border-neutral-300 bg-white px-2 text-caption text-neutral-700 transition-colors duration-150 hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            {TREATMENT_PLAN_PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        }
      />
        </>
      )}

      <CreatePlanDrawer
        open={createOpen}
        onClose={closeCreate}
        doctorOptions={doctorOptions}
        doctorsLoading={doctorsQuery.isLoading}
        onSubmit={handleCreate}
        submitting={createMutation.isPending}
        serverErrors={createFieldErrors}
        serverMessage={createError}
        initialPatientId={createPatientId ?? undefined}
        selectedPatientLabel={selectedPatientLabel ?? undefined}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
