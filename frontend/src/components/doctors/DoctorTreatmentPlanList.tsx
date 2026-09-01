import { useMemo, useState, type FC } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from '../../hooks/treatmentPlans/treatmentPlanQueryKeys';
import { useTreatmentPlanNames } from '../../hooks/treatmentPlans/useTreatmentPlanNames';
import { DataTable } from '../common/DataTable/DataTable';
import { Pagination } from '../common/Pagination/Pagination';
import { TreatmentPlanStatusBadge } from '../treatmentPlans/TreatmentPlanStatusBadge';
import { formatISODate } from '../../utils/date';
import { formatCurrency } from '../../utils/formatting';
import {
  TREATMENT_PLAN_LIST_PAGE_SIZE,
  TREATMENT_PLAN_CURRENCY_CODE,
  TREATMENT_PLAN_STATUS_FILTERS,
} from '../../constants/treatmentPlan';
import { ROUTES } from '../../routes/routes';
import { apiErrorMessage } from '../../services/apiError';
import type { TreatmentPlanStatus, EnrichedTreatmentPlan } from '../../types/treatmentPlan';
import type { DoctorProfileResponse } from '../../types/doctor';

interface DoctorTreatmentPlanListProps {
  /**
   * Doctor profile.
   *
   * IMPORTANT — Doctor ID Invariant (F-6):
   * Treatment Plans are keyed by `Doctor.id` (UUID), NOT `User.id` (integer).
   * The treatment plan FK is `doctor_id → doctors.id`, so we MUST use `doctor.id` here.
   * Do NOT use `doctor.user_id` — that is the User integer PK, not the Doctor UUID.
   *
   * NOTE: This is the OPPOSITE of appointments (DoctorAppointmentList),
   * which uses `doctor.user_id` because appointments reference `dentist_id → users.id`.
   */
  doctor: DoctorProfileResponse;
}

type StatusFilter = 'all' | TreatmentPlanStatus;

/**
 * DoctorTreatmentPlanList — embedded, read-only treatment plan list
 * for the Doctor Details → Treatment Plans tab.
 *
 * Data source: GET /treatment-plans/by-doctor/{doctor.id}
 *
 * Uses server-side filtering (status) and pagination (page/page_size).
 * No lifecycle mutations — those belong to the Treatment Plan module.
 *
 * CRITICAL: Uses doctor.id (UUID), NOT doctor.user_id (Integer).
 */
export const DoctorTreatmentPlanList: FC<DoctorTreatmentPlanListProps> = ({ doctor }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TREATMENT_PLAN_LIST_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const params = useMemo(
    () => ({
      page,
      page_size: pageSize,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    [page, pageSize, statusFilter],
  );

  const query = useQuery({
    queryKey: treatmentPlanQueryKeys.byDoctor(doctor.id, params),
    queryFn: () => treatmentPlanService.listByDoctor(doctor.id, params),
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.total_pages ?? Math.max(1, Math.ceil(total / pageSize));

  // Resolve patient names (doctor name is known from page context)
  const patientIds = useMemo(
    () => Array.from(new Set(items.map((p) => p.patient_id))),
    [items],
  );
  const names = useTreatmentPlanNames(patientIds, []);

  const enriched = useMemo<EnrichedTreatmentPlan[]>(
    () =>
      items.map((p) => ({
        ...p,
        patient_name: names.data?.patientNames.get(p.patient_id) ?? null,
        doctor_name: doctor.user_full_name ?? null,
      })),
    [items, names.data, doctor.user_full_name],
  );

  const queryError = query.error ? apiErrorMessage(query.error) : null;

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Status filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="doctor-tp-status-filter" className="text-body-sm font-medium text-neutral-600">
          Status:
        </label>
        <select
          id="doctor-tp-status-filter"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-48 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-body-sm text-neutral-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {TREATMENT_PLAN_STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataTable<EnrichedTreatmentPlan>
        ariaLabel="Doctor treatment plans"
        data={enriched}
        rowKey={(plan) => plan.id}
        loading={query.isLoading}
        error={queryError}
        onRetry={() => void query.refetch()}
        emptyTitle="No treatment plans found"
        emptyDescription={
          statusFilter !== 'all'
            ? 'No treatment plans match the selected filters.'
            : 'No treatment plans found for this doctor.'
        }
        columns={[
          {
            key: 'plan_code',
            header: 'Plan Code',
            accessor: 'plan_code',
            render: (row) => (
              <Link
                to={`${ROUTES.TREATMENT_PLANS}/${row.id}`}
                className="font-mono text-caption font-medium text-primary-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                onClick={(e) => e.stopPropagation()}
              >
                {row.plan_code}
              </Link>
            ),
          },
          {
            key: 'patient',
            header: 'Patient',
            render: (row) => (
              <span className="font-medium text-neutral-900">
                {row.patient_name ?? `Patient #${row.patient_id}`}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <TreatmentPlanStatusBadge status={row.status} />,
          },
          {
            key: 'item_count',
            header: 'Items',
            accessor: 'item_count',
            align: 'center',
            cellClassName: 'tabular-nums',
          },
          {
            key: 'total_estimated_cost',
            header: 'Estimated Cost',
            accessor: 'total_estimated_cost',
            align: 'right',
            cellClassName: 'tabular-nums font-medium',
            render: (row) => formatCurrency(row.total_estimated_cost, TREATMENT_PLAN_CURRENCY_CODE),
          },
          {
            key: 'created_at',
            header: 'Created',
            accessor: 'created_at',
            render: (row) => formatISODate(row.created_at),
          },
        ]}
        pagination={
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalCount={total}
            pageSize={pageSize}
            pageSizeSelector={
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-body-sm text-neutral-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                aria-label="Rows per page"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            }
          />
        }
      />
    </div>
  );
};
