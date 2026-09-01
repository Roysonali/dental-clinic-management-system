import { useMemo, useState, type FC } from 'react';
import { Link } from 'react-router-dom';
import { useAppointments } from '../../hooks/appointments/useAppointments';
import { DataTable } from '../common/DataTable/DataTable';
import { Pagination } from '../common/Pagination/Pagination';
import { Badge } from '../common/Badge/Badge';
import { AppointmentStatusBadge } from '../appointments/AppointmentStatusBadge';
import { formatISODate, formatTimeRange } from '../../utils/date';
import {
  APPOINTMENT_LIST_PAGE_SIZE,
  APPOINTMENT_STATUS_FILTERS,
  APPOINTMENT_TYPE_LABELS,
} from '../../constants/appointment';
import { ROUTES } from '../../routes/routes';
import { apiErrorMessage } from '../../services/apiError';
import type {
  AppointmentResponse,
  AppointmentStatus,
  AppointmentStatus as AppointmentStatusType,
} from '../../types/appointment';
import type { DoctorProfileResponse } from '../../types/doctor';

interface DoctorAppointmentListProps {
  /** Doctor profile — used to extract user_id for dentist_id filter */
  doctor: DoctorProfileResponse;
}

type StatusFilter = 'all' | AppointmentStatusType;

/**
 * DoctorAppointmentList — embedded, read-only appointment list
 * for the Doctor Details → Appointments tab.
 *
 * Data source: GET /appointments?dentist_id={doctor.user_id}
 *
 * Uses server-side filtering (status) and pagination (skip/limit).
 * No lifecycle mutations — those belong to the Appointment module.
 */
export const DoctorAppointmentList: FC<DoctorAppointmentListProps> = ({ doctor }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(APPOINTMENT_LIST_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const skip = (page - 1) * pageSize;

  const params = useMemo(
    () => ({
      dentist_id: doctor.user_id,
      skip,
      limit: pageSize,
      ...(statusFilter !== 'all' ? { status: statusFilter as AppointmentStatus } : {}),
    }),
    [doctor.user_id, skip, pageSize, statusFilter],
  );

  const query = useAppointments(params);

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
        <label htmlFor="doctor-appointment-status-filter" className="text-body-sm font-medium text-neutral-600">
          Status:
        </label>
        <select
          id="doctor-appointment-status-filter"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-48 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-body-sm text-neutral-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {APPOINTMENT_STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataTable<AppointmentResponse>
        ariaLabel="Doctor appointments"
        data={items}
        rowKey={(apt) => apt.id}
        loading={query.isLoading}
        error={queryError}
        onRetry={() => void query.refetch()}
        emptyTitle="No appointments found"
        emptyDescription={
          statusFilter !== 'all'
            ? 'No appointments match the selected filters.'
            : 'No appointments found for this doctor.'
        }
        columns={[
          {
            key: 'appointment_number',
            header: 'Appointment #',
            accessor: 'appointment_number',
            render: (row) => (
              <Link
                to={`${ROUTES.APPOINTMENTS}/${row.id}`}
                className="font-mono text-caption font-medium text-primary-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                onClick={(e) => e.stopPropagation()}
              >
                {row.appointment_number}
              </Link>
            ),
          },
          {
            key: 'appointment_date',
            header: 'Date',
            accessor: 'appointment_date',
            render: (row) => formatISODate(row.appointment_date),
          },
          {
            key: 'time',
            header: 'Time',
            render: (row) => formatTimeRange(row.start_time, row.end_time),
          },
          {
            key: 'patient',
            header: 'Patient',
            render: (row) => (
              <span className="font-medium text-neutral-900">
                {row.patient_name ?? '—'}
              </span>
            ),
          },
          {
            key: 'appointment_type',
            header: 'Type',
            accessor: 'appointment_type',
            render: (row) => (
              <Badge variant="secondary" size="sm">
                {APPOINTMENT_TYPE_LABELS[row.appointment_type] ?? row.appointment_type}
              </Badge>
            ),
          },
          {
            key: 'duration',
            header: 'Duration',
            accessor: 'duration_minutes',
            align: 'right',
            cellClassName: 'tabular-nums',
            render: (row) => `${row.duration_minutes} min`,
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <AppointmentStatusBadge status={row.status} size="sm" />,
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
