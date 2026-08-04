import type { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { AppointmentStatusBadge } from './AppointmentStatusBadge';
import { Badge } from '../common/Badge/Badge';
import { Divider } from '../common/Divider/Divider';
import { ROUTES } from '../../routes/routes';
import { formatISODate, formatTimeRange } from '../../utils/date';
import { APPOINTMENT_TYPE_LABELS } from '../../constants/appointment';
import type { EnrichedAppointment } from '../../types/appointment';

interface AppointmentDetailsHeaderProps {
  /** Enriched appointment record */
  appointment: EnrichedAppointment;
  /** Actions rendered on the right (Edit, Cancel) */
  actions?: ReactNode;
}

/**
 * AppointmentDetailsHeader — details-page hero: back link, appointment
 * number, status, type, schedule summary, and action buttons.
 */
export const AppointmentDetailsHeader: FC<AppointmentDetailsHeaderProps> = ({
  appointment,
  actions,
}) => {
  return (
    <div>
      <Link
        to={ROUTES.APPOINTMENTS}
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-neutral-500 transition-colors duration-150 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Appointments
      </Link>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Identity */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-h2 font-semibold text-neutral-900">
                {appointment.appointment_number}
              </h1>
              <AppointmentStatusBadge status={appointment.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" size="sm">
                {APPOINTMENT_TYPE_LABELS[appointment.appointment_type] ??
                  appointment.appointment_type}
              </Badge>
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-body-sm text-neutral-600">
              <div className="flex items-center gap-1.5">
                <dt className="text-neutral-400">Date</dt>
                <dd className="font-medium text-neutral-800">
                  {formatISODate(appointment.appointment_date)}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-neutral-400">Time</dt>
                <dd className="font-medium text-neutral-800">
                  {formatTimeRange(appointment.start_time, appointment.end_time)}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-neutral-400">Duration</dt>
                <dd className="font-medium text-neutral-800 tabular-nums">
                  {appointment.duration_minutes} min
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions */}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>

        <Divider variant="subtle" className="my-4" />

        {/* Created / updated */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-caption text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={14} aria-hidden="true" />
            Created {formatISODate(appointment.created_at)}
          </span>
          {appointment.updated_at && (
            <span className="inline-flex items-center gap-1.5">
              Last updated {formatISODate(appointment.updated_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
