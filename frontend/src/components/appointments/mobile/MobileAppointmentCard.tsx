import type { FC } from 'react';
import { MobileCard } from '../../../layouts/components/mobile/MobileCard';
import { Badge } from '../../common/Badge/Badge';
import { AppointmentStatusBadge } from '../AppointmentStatusBadge';
import { APPOINTMENT_TYPE_LABELS } from '../../../constants/appointment';
import { formatISODate, formatTimeRange } from '../../../utils/date';
import type { EnrichedAppointment } from '../../../types/appointment';

interface MobileAppointmentCardProps {
  appointment: EnrichedAppointment;
  /** Navigates to the appointment detail page. */
  onClick?: () => void;
}

/**
 * MobileAppointmentCard — mobile presentation of an appointment row
 * (reference card language: number + status pill, bold patient, muted
 * dentist line, divider, footer with date/time + type badge).
 */
export const MobileAppointmentCard: FC<MobileAppointmentCardProps> = ({
  appointment,
  onClick,
}) => {
  const patientName = appointment.patient_name ?? `Patient #${appointment.patient_id}`;
  const dentistName = appointment.dentist_name ?? `Dentist #${appointment.dentist_id}`;

  return (
    <MobileCard onClick={onClick} ariaLabel={`View ${appointment.appointment_number}`}>
      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-sm font-semibold tracking-tight text-neutral-900">
          {appointment.appointment_number}
        </span>
        <AppointmentStatusBadge status={appointment.status} />
      </span>

      <span className="mt-3 block truncate text-lg font-semibold text-neutral-900">
        {patientName}
      </span>
      <span className="mt-1 block truncate text-sm text-neutral-500">{dentistName}</span>

      <span className="my-4 block h-px w-full bg-neutral-100" />

      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-neutral-500">
          {formatISODate(appointment.appointment_date)} ·{' '}
          {formatTimeRange(appointment.start_time, appointment.end_time)}
        </span>
        <Badge variant="secondary" size="sm" className="shrink-0">
          {APPOINTMENT_TYPE_LABELS[appointment.appointment_type] ?? appointment.appointment_type}
        </Badge>
      </span>
    </MobileCard>
  );
};
