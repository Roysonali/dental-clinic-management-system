import type { FC } from 'react';
import { CalendarX2 } from 'lucide-react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { AppointmentStatusBadge } from './AppointmentStatusBadge';
import { formatISODate, formatTimeRange } from '../../utils/date';
import type {
  AppointmentResponse,
  EnrichedAppointment,
} from '../../types/appointment';

type CancelAppointment = AppointmentResponse | EnrichedAppointment;

interface CancelAppointmentDialogProps {
  /** Open state */
  open: boolean;
  /** The appointment being cancelled */
  appointment: CancelAppointment | null;
  /** Show loading on the confirm button */
  submitting?: boolean;
  /** Error banner message (e.g. backend 400/409) */
  error?: string | null;
  /** Called when the user confirms the cancellation */
  onConfirm: () => void;
  /** Called to close the dialog */
  onClose: () => void;
}

/**
 * CancelAppointmentDialog — confirmation for PATCH /appointments/{id}/cancel.
 *
 * Mirrors the patient module's PatientStatusDialog pattern. The parent only
 * opens this for cancellable statuses (Scheduled / Confirmed — the backend
 * rejects other transitions with a 400).
 */
export const CancelAppointmentDialog: FC<CancelAppointmentDialogProps> = ({
  open,
  appointment,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const patientName =
    'patient_name' in (appointment ?? {})
      ? (appointment as EnrichedAppointment).patient_name
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel="Cancel appointment"
    >
      <Modal.Header>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            <Icon icon={CalendarX2} size="md" />
          </span>
          <div>
            <h2 className="text-h4 font-semibold text-neutral-900">Cancel Appointment</h2>
            <p className="mt-0.5 text-body-sm text-neutral-500">
              {appointment?.appointment_number}
            </p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-3">
            <p className="text-body-sm text-danger">{error}</p>
          </div>
        )}

        {appointment && (
          <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <dl className="flex flex-col gap-1.5 text-body-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-neutral-500">Patient</dt>
                <dd className="font-medium text-neutral-900">
                  {patientName ?? `Patient #${appointment.patient_id}`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-neutral-500">Schedule</dt>
                <dd className="font-medium text-neutral-900">
                  {formatISODate(appointment.appointment_date)} ·{' '}
                  {formatTimeRange(appointment.start_time, appointment.end_time)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-neutral-500">Status</dt>
                <dd>
                  <AppointmentStatusBadge status={appointment.status} size="sm" />
                </dd>
              </div>
            </dl>
          </div>
        )}

        <p className="text-body text-neutral-700">
          This appointment will be marked as{' '}
          <span className="font-semibold text-danger">Cancelled</span>. This action cannot be
          undone — the slot becomes available for rebooking.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Keep Appointment
        </Button>
        <Button variant="danger" loading={submitting} onClick={onConfirm}>
          Yes, Cancel Appointment
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
