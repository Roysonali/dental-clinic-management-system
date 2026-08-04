import type { FC, ReactNode } from 'react';
import { formatISODate, formatTimeRange } from '../../utils/date';
import { AppointmentStatusBadge } from './AppointmentStatusBadge';
import { APPOINTMENT_TYPE_LABELS } from '../../constants/appointment';
import type { AppointmentResponse } from '../../types/appointment';

interface AppointmentInfoCardProps {
  /** Full appointment record */
  appointment: AppointmentResponse;
}

/** Definition-list row helper. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-body-sm text-neutral-500">{label}</dt>
      <dd className="text-body-sm font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

/**
 * AppointmentInfoCard — schedule facts + visit reason + notes for the
 * appointment details page.
 */
export const AppointmentInfoCard: FC<AppointmentInfoCardProps> = ({ appointment }) => {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-h4 font-semibold text-neutral-900">Appointment Details</h3>

      <dl className="divide-y divide-neutral-100">
        <DetailRow label="Date">{formatISODate(appointment.appointment_date)}</DetailRow>
        <DetailRow label="Time">
          {formatTimeRange(appointment.start_time, appointment.end_time)}
        </DetailRow>
        <DetailRow label="Duration">{appointment.duration_minutes} minutes</DetailRow>
        <DetailRow label="Type">
          {APPOINTMENT_TYPE_LABELS[appointment.appointment_type] ?? appointment.appointment_type}
        </DetailRow>
        <DetailRow label="Status">
          <AppointmentStatusBadge status={appointment.status} size="sm" />
        </DetailRow>
      </dl>

      <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
        <div>
          <h4 className="mb-1 text-label font-semibold text-neutral-600">Reason for Visit</h4>
          <p className="text-body text-neutral-700">{appointment.reason_for_visit}</p>
        </div>
        <div>
          <h4 className="mb-1 text-label font-semibold text-neutral-600">Notes</h4>
          {appointment.notes ? (
            <p className="whitespace-pre-wrap text-body text-neutral-700">{appointment.notes}</p>
          ) : (
            <p className="text-body text-neutral-400">No notes recorded for this appointment.</p>
          )}
        </div>
      </div>
    </div>
  );
};
