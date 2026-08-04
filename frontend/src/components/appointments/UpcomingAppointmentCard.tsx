import type { FC } from 'react';
import { AppointmentStatusBadge } from './AppointmentStatusBadge';
import { PatientAvatar } from '../patients/PatientAvatar';
import { Badge } from '../common/Badge/Badge';
import { Icon } from '../common/Icon/Icon';
import { Clock } from 'lucide-react';
import { APPOINTMENT_TYPE_LABELS } from '../../constants/appointment';
import { formatTimeRange } from '../../utils/date';
import type { AppointmentStatus, AppointmentType } from '../../types/appointment';

export interface UpcomingAppointmentCardProps {
  /** Patient full name */
  patientName: string;
  /** Dentist display name (may be unresolved → null) */
  dentistName?: string | null;
  /** `HH:MM:SS` start, or pre-formatted label like "10:00 AM" */
  start_time: string;
  /** `HH:MM:SS` end */
  end_time: string;
  /** Appointment type */
  type: AppointmentType;
  /** Visual status */
  status: AppointmentStatus;
  /** Optional click handler */
  onClick?: () => void;
}

/**
 * UpcomingAppointmentCard — compact row used by the dashboard's "Upcoming
 * Appointments" section. Derives initials + status badge from the appointment.
 */
export const UpcomingAppointmentCard: FC<UpcomingAppointmentCardProps> = ({
  patientName,
  dentistName,
  start_time,
  end_time,
  type,
  status,
  onClick,
}) => {
  return (
    <div
      className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4 transition-colors duration-150 hover:border-neutral-300"
      {...(onClick ? { onClick } : {})}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Time */}
      <div className="flex shrink-0 flex-col items-center">
        <span className="text-caption font-semibold text-neutral-900">
          {formatTimeRange(start_time, end_time)}
        </span>
      </div>

      {/* Patient */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PatientAvatar fullName={patientName} size="sm" />
        <div className="min-w-0">
          <p className="text-body-sm font-semibold text-neutral-900 truncate">
            {patientName}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-caption text-neutral-500 truncate">
            <Icon icon={Clock} size="xs" className="text-neutral-400" />
            <Badge variant="secondary" size="xs">
              {APPOINTMENT_TYPE_LABELS[type] ?? type}
            </Badge>
          </p>
          {dentistName && (
            <p className="text-caption text-neutral-400 truncate">with {dentistName}</p>
          )}
        </div>
      </div>

      {/* Status */}
      <AppointmentStatusBadge status={status} size="sm" />
    </div>
  );
};
