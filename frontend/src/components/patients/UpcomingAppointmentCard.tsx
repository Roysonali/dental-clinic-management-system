import { useMemo, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { usePatientAppointments } from '../../hooks/appointments/usePatientAppointments';
import { useAppointmentNames } from '../../hooks/appointments/useAppointmentNames';
import { formatISODate, formatTimeRange } from '../../utils/date';
import { ROUTES } from '../../routes/routes';

interface UpcomingAppointmentCardProps {
  /** Patient UUID — fetches upcoming appointments for this patient */
  patientId: string;
}

/**
 * UpcomingAppointmentCard — next scheduled appointment for a patient.
 *
 * Shows the next upcoming (Scheduled/Confirmed) appointment for the given
 * patient. Falls back to empty state when no upcoming appointments exist.
 */
export const UpcomingAppointmentCard: FC<UpcomingAppointmentCardProps> = ({
  patientId,
}) => {
  const navigate = useNavigate();

  const appointmentsQuery = usePatientAppointments(patientId, {
    skip: 0,
    limit: 50,
  });

  // Find the next upcoming appointment (Scheduled or Confirmed, date >= today)
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const items = appointmentsQuery.data?.items ?? [];
    return (
      items
        .filter(
          (a) =>
            (a.status === 'Scheduled' || a.status === 'Confirmed') &&
            a.appointment_date >= today,
        )
        .sort((a, b) => {
          if (a.appointment_date !== b.appointment_date) {
            return a.appointment_date.localeCompare(b.appointment_date);
          }
          return a.start_time.localeCompare(b.start_time);
        })[0] ?? null
    );
  }, [appointmentsQuery.data?.items]);

  // Resolve dentist name
  const dentistIds = useMemo(
    () => (upcoming ? [upcoming.dentist_id] : []),
    [upcoming],
  );
  const names = useAppointmentNames([], dentistIds);
  const dentistName = upcoming
    ? names.data?.dentistNames.get(upcoming.dentist_id) ?? null
    : null;

  if (appointmentsQuery.isLoading) {
    return (
      <Card>
        <Card.Header
          title="Upcoming Appointment"
          icon={<Icon icon={CalendarClock} size="md" className="text-success" />}
        />
        <Card.Body>
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header
        title="Upcoming Appointment"
        icon={<Icon icon={CalendarClock} size="md" className="text-success" />}
      />
      <Card.Body>
        {upcoming ? (
          <button
            type="button"
            onClick={() => navigate(`${ROUTES.APPOINTMENTS}/${upcoming.id}`)}
            className="w-full text-left transition-colors duration-150 hover:bg-neutral-50 -mx-2 px-2 py-1.5 rounded-lg"
          >
            <p className="text-body-bold text-neutral-900">
              {formatISODate(upcoming.appointment_date)} at {formatTimeRange(upcoming.start_time, upcoming.end_time)}
            </p>
            <p className="text-body text-neutral-600 mt-1">
              {dentistName ?? `Dentist #${upcoming.dentist_id}`} — {upcoming.appointment_type}
            </p>
            {upcoming.reason_for_visit && (
              <p className="text-caption text-neutral-500 mt-1 truncate">
                {upcoming.reason_for_visit}
              </p>
            )}
          </button>
        ) : (
          <EmptyState
            title="No upcoming appointments"
            description="Scheduled appointments for this patient will appear here."
          />
        )}
      </Card.Body>
    </Card>
  );
};
