import type { FC } from 'react';
import { Clock } from 'lucide-react';
import { Icon } from '../../components/common/Icon/Icon';
import { Badge } from '../../components/common/Badge/Badge';

/**
 * AppointmentItem — single appointment in the upcoming list.
 *
 * Placeholder component — no business logic, no real data.
 *
 * @example
 * ```tsx
 * <AppointmentItem
 *   patientName="Juan Dela Cruz"
 *   time="10:00 AM"
 *   type="Consultation"
 *   status="confirmed"
 * />
 * ```
 */
interface AppointmentItemProps {
  /** Patient name */
  patientName: string;
  /** Appointment time */
  time: string;
  /** Appointment type */
  type: string;
  /** Visual status label */
  status?: string;
}

export const AppointmentItem: FC<AppointmentItemProps> = ({
  patientName,
  time,
  type,
  status,
}) => {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4 transition-colors duration-150 hover:border-neutral-300">
      {/* Time */}
      <div className="flex shrink-0 flex-col items-center">
        <span className="text-caption font-semibold text-neutral-900">{time}</span>
      </div>

      {/* Divider dot */}
      <div className="h-2 w-2 shrink-0 rounded-full bg-primary-400" aria-hidden="true" />

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-neutral-900 truncate">
          {patientName}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <Icon icon={Clock} size="xs" className="text-neutral-400" />
          <span className="text-caption text-neutral-500">{type}</span>
        </div>
      </div>

      {/* Status badge */}
      {status && (
        <Badge variant="info" size="xs">
          {status}
        </Badge>
      )}
    </div>
  );
};
