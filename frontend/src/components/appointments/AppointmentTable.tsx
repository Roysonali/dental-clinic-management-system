import type { FC } from 'react';
import { CalendarPlus, CalendarX2, Eye, Pencil } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Badge } from '../common/Badge/Badge';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { Button } from '../common/Button/Button';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { PatientAvatar } from '../patients/PatientAvatar';
import { AppointmentStatusBadge } from './AppointmentStatusBadge';
import { AppointmentToolbar } from './AppointmentToolbar';
import { formatISODate, formatTimeRange } from '../../utils/date';
import {
  APPOINTMENT_TYPE_LABELS,
  canCancelAppointment,
  type AppointmentStatusFilter,
} from '../../constants/appointment';
import type { EnrichedAppointment } from '../../types/appointment';

export interface AppointmentTableProps {
  /** Paginated, name-enriched appointment rows */
  appointments: EnrichedAppointment[];
  /** Name lookups still in flight (renders skeletons in name columns) */
  namesLoading?: boolean;
  /** List-level loading (skeleton rows) */
  loading?: boolean;
  /** List-level error (error panel with retry) */
  error?: string | null;
  /** Retry callback for the error panel */
  onRetry?: () => void;
  /* ── Toolbar (search + status filter + create) ── */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchLoading?: boolean;
  statusFilter?: AppointmentStatusFilter;
  onStatusFilterChange?: (status: AppointmentStatusFilter) => void;
  /** Open the "New Appointment" drawer */
  onCreate?: () => void;
  /* ── Row actions ── */
  /** View the appointment details */
  onView?: (appointment: EnrichedAppointment) => void;
  /** Open the edit drawer */
  onEdit?: (appointment: EnrichedAppointment) => void;
  /** Open the cancel confirmation */
  onCancel?: (appointment: EnrichedAppointment) => void;
  /** Click a row → view details */
  onRowClick?: (appointment: EnrichedAppointment) => void;
}

/** Name cell shared by Patient / Dentist columns. */
function NameCell({
  name,
  loading,
  fallback,
}: {
  name: string | null | undefined;
  loading: boolean;
  fallback: string;
}) {
  if (loading && !name) {
    return <Skeleton className="h-5 w-40" />;
  }
  if (name) {
    return (
      <span className="inline-flex items-center gap-3">
        <PatientAvatar fullName={name} size="sm" />
        <span className="font-medium text-neutral-900">{name}</span>
      </span>
    );
  }
  return <span className="text-neutral-400">{fallback}</span>;
}

/**
 * AppointmentTable — appointment-specific DataTable.
 *
 * Reuses the generic DataTable infrastructure (sorting, loading/empty/error
 * states, row actions). The backend list returns only ids, so patient/dentist
 * names are enriched upstream by `useAppointmentNames` and displayed via
 * `NameCell` with a graceful fallback when a name can't be resolved.
 *
 * Row actions mirror the backend lifecycle: View (any status), Edit (disabled
 * for Completed — the service rejects it), Cancel (only from Scheduled /
 * Confirmed — the only transition the validator allows).
 */
export const AppointmentTable: FC<AppointmentTableProps> = ({
  appointments,
  namesLoading = false,
  loading = false,
  error = null,
  onRetry,
  searchValue,
  onSearchChange,
  searchLoading = false,
  statusFilter = 'all',
  onStatusFilterChange,
  onCreate,
  onView,
  onEdit,
  onCancel,
  onRowClick,
}) => {
  return (
    <DataTable<EnrichedAppointment>
      ariaLabel="Appointments table"
      data={appointments}
      rowKey={(appointment) => appointment.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={onRowClick}
      emptyTitle="No appointments found"
      emptyDescription="Try adjusting your search or filters, or create a new appointment."
      emptyAction={
        onCreate ? (
          <Button
            size="md"
            onClick={onCreate}
            leftIcon={<Icon icon={CalendarPlus} size="md" />}
            className="shrink-0 whitespace-nowrap"
          >
            New Appointment
          </Button>
        ) : undefined
      }
      toolbar={({ columnVisibility, setColumnVisibility }) => (
        <AppointmentToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchLoading={searchLoading}
          status={statusFilter}
          onStatusChange={onStatusFilterChange ?? (() => undefined)}
          onCreate={onCreate ?? (() => undefined)}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
        />
      )}
      columns={[
        {
          key: 'appointment_number',
          header: 'Appointment #',
          accessor: 'appointment_number',
          sortable: true,
          hideable: true,
          render: (row) => (
            <span className="font-mono text-caption text-neutral-600">
              {row.appointment_number}
            </span>
          ),
        },
        {
          key: 'patient',
          header: 'Patient',
          sortable: true,
          hideable: true,
          sortValue: (row) => row.patient_name ?? '',
          render: (row) => (
            <NameCell
              name={row.patient_name}
              loading={namesLoading}
              fallback={`Patient #${row.patient_id}`}
            />
          ),
        },
        {
          key: 'dentist',
          header: 'Dentist',
          sortable: true,
          hideable: true,
          sortValue: (row) => row.dentist_name ?? '',
          render: (row) => (
            <NameCell
              name={row.dentist_name}
              loading={namesLoading}
              fallback={`Dentist #${row.dentist_id}`}
            />
          ),
        },
        {
          key: 'appointment_date',
          header: 'Date',
          accessor: 'appointment_date',
          sortable: true,
          hideable: true,
          sortValue: (row) => new Date(row.appointment_date),
          render: (row) => formatISODate(row.appointment_date),
        },
        {
          key: 'time',
          header: 'Time',
          sortable: true,
          hideable: true,
          sortValue: (row) => row.start_time,
          render: (row) => formatTimeRange(row.start_time, row.end_time),
        },
        {
          key: 'duration_minutes',
          header: 'Duration',
          accessor: 'duration_minutes',
          sortable: true,
          hideable: true,
          align: 'right',
          cellClassName: 'tabular-nums',
          render: (row) => `${row.duration_minutes} min`,
        },
        {
          key: 'appointment_type',
          header: 'Type',
          accessor: 'appointment_type',
          sortable: true,
          hideable: true,
          render: (row) => (
            <Badge variant="secondary" size="sm">
              {APPOINTMENT_TYPE_LABELS[row.appointment_type] ?? row.appointment_type}
            </Badge>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          sortable: true,
          hideable: true,
          sortValue: (row) => row.status,
          render: (row) => <AppointmentStatusBadge status={row.status} size="sm" />,
        },
      ]}
      rowActions={(appointment) => (
        <span className="inline-flex items-center justify-end gap-1">
          {onView && (
            <IconButton
              icon={<Icon icon={Eye} size="sm" />}
              aria-label={`View ${appointment.appointment_number}`}
              size="sm"
              variant="ghost"
              onClick={() => onView(appointment)}
            />
          )}
          {onEdit && (
            <IconButton
              icon={<Icon icon={Pencil} size="sm" />}
              aria-label={`Edit ${appointment.appointment_number}`}
              size="sm"
              variant="ghost"
              disabled={appointment.status === 'Completed'}
              onClick={() => onEdit(appointment)}
            />
          )}
          {onCancel && canCancelAppointment(appointment.status) && (
            <IconButton
              icon={<Icon icon={CalendarX2} size="sm" />}
              aria-label={`Cancel ${appointment.appointment_number}`}
              size="sm"
              variant="ghost"
              onClick={() => onCancel(appointment)}
            />
          )}
        </span>
      )}
    />
  );
};
