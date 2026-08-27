import { useMemo, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { Badge } from '../common/Badge/Badge';
import { AppointmentStatusBadge } from '../appointments/AppointmentStatusBadge';
import { usePatientAppointments } from '../../hooks/appointments/usePatientAppointments';
import { useAppointmentNames } from '../../hooks/appointments/useAppointmentNames';
import { formatISODate, formatTimeRange } from '../../utils/date';
import { APPOINTMENT_TYPE_LABELS } from '../../constants/appointment';
import { ROUTES } from '../../routes/routes';
import { apiErrorMessage } from '../../services/apiError';
import type { CreateActionType } from './PatientQuickActions';
import type { EnrichedAppointment } from '../../types/appointment';

interface PatientAppointmentsTabProps {
  /** Patient UUID — passed to GET /patients/{id}/appointments */
  patientId: string;
  /** Callback to open the contextual create drawer. When provided, the empty-state CTA
   *  uses this instead of navigating away from Patient Hub. */
  onCreateAction?: (action: CreateActionType) => void;
}

/**
 * PatientAppointmentsTab — renders a paginated list of appointments
 * belonging to a single patient.
 *
 * Data source: GET /patients/{patientId}/appointments
 *
 * Reuses the existing DataTable infrastructure and appointment display
 * components (AppointmentStatusBadge). Dentist names are resolved via
 * useAppointmentNames so the table shows human-readable names instead of
 * raw IDs.
 */
export const PatientAppointmentsTab: FC<PatientAppointmentsTabProps> = ({
  patientId,
  onCreateAction,
}) => {
  const navigate = useNavigate();

  const appointmentsQuery = usePatientAppointments(patientId, {
    skip: 0,
    limit: 100,
  });

  const items = useMemo(
    () => appointmentsQuery.data?.items ?? [],
    [appointmentsQuery.data?.items],
  );

  // Resolve dentist names (patient name is already known from the page context)
  const dentistIds = useMemo(
    () => Array.from(new Set(items.map((a) => a.dentist_id))).sort((a, b) => a - b),
    [items],
  );

  const names = useAppointmentNames([], dentistIds);

  const enriched = useMemo<EnrichedAppointment[]>(
    () =>
      items.map((a) => ({
        ...a,
        // Patient name is not needed — we're viewing a specific patient
        patient_name: null,
        dentist_name: names.data?.dentistNames.get(a.dentist_id) ?? null,
      })),
    [items, names.data],
  );

  const queryError = appointmentsQuery.error
    ? apiErrorMessage(appointmentsQuery.error)
    : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <DataTable<EnrichedAppointment>
        ariaLabel="Patient appointments"
        data={enriched}
        rowKey={(appointment) => appointment.id}
        loading={appointmentsQuery.isLoading}
        error={queryError}
        onRetry={() => void appointmentsQuery.refetch()}
        onRowClick={(appointment) =>
          navigate(`${ROUTES.APPOINTMENTS}/${appointment.id}`)
        }
        emptyTitle="No appointments"
        emptyDescription="Appointments for this patient will appear here once they are booked."
        emptyAction={
          <Button
            size="md"
            onClick={() =>
              onCreateAction
                ? onCreateAction('appointment')
                : navigate(`${ROUTES.APPOINTMENTS}?create=true&patientId=${patientId}`)
            }
            leftIcon={<Icon icon={CalendarPlus} size="md" />}
            className="shrink-0 whitespace-nowrap"
          >
            Book Appointment
          </Button>
        }
        columns={[
          {
            key: 'appointment_number',
            header: 'Appointment #',
            accessor: 'appointment_number',
            sortable: true,
            render: (row) => (
              <span className="font-mono text-caption text-neutral-600">
                {row.appointment_number}
              </span>
            ),
          },
          {
            key: 'dentist',
            header: 'Dentist',
            sortable: true,
            sortValue: (row) => row.dentist_name ?? '',
            render: (row) => (
              <span className="font-medium text-neutral-900">
                {row.dentist_name ?? `Dentist #${row.dentist_id}`}
              </span>
            ),
          },
          {
            key: 'appointment_date',
            header: 'Date',
            accessor: 'appointment_date',
            sortable: true,
            sortValue: (row) => new Date(row.appointment_date),
            render: (row) => formatISODate(row.appointment_date),
          },
          {
            key: 'time',
            header: 'Time',
            sortable: true,
            sortValue: (row) => row.start_time,
            render: (row) => formatTimeRange(row.start_time, row.end_time),
          },
          {
            key: 'duration_minutes',
            header: 'Duration',
            accessor: 'duration_minutes',
            sortable: true,
            align: 'right',
            cellClassName: 'tabular-nums',
            render: (row) => `${row.duration_minutes} min`,
          },
          {
            key: 'appointment_type',
            header: 'Type',
            accessor: 'appointment_type',
            sortable: true,
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
            sortValue: (row) => row.status,
            render: (row) => <AppointmentStatusBadge status={row.status} size="sm" />,
          },
        ]}
      />
    </div>
  );
};
