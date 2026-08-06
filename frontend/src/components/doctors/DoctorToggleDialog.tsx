import type { FC } from 'react';
import { CalendarCheck, CalendarOff, CalendarX } from 'lucide-react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import type { DoctorResponse } from '../../types/doctor';

export type DoctorToggleIntent = 'availability' | 'leave';

interface DoctorToggleDialogProps {
  /** Open state */
  open: boolean;
  /** The doctor being acted on */
  doctor: DoctorResponse | null;
  /** Which flag the toggle will flip */
  intent: DoctorToggleIntent | null;
  /** Show loading on the confirm button */
  submitting?: boolean;
  /** Error banner message (e.g. backend 400/403) */
  error?: string | null;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Called to close the dialog */
  onClose: () => void;
}

/**
 * DoctorToggleDialog — confirmation for the body-less toggle endpoints:
 * - PATCH /doctors/{id}/availability → flips `available_for_appointment`
 * - PATCH /doctors/{id}/leave         → flips `on_leave`
 *
 * Reuses the shared Modal confirmation pattern (same as DoctorStatusDialog)
 * and surfaces backend errors (400 inactive-doctor availability, 403)
 * via the `error` prop.
 */
export const DoctorToggleDialog: FC<DoctorToggleDialogProps> = ({
  open,
  doctor,
  intent,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  if (!intent) return null;

  const isAvailability = intent === 'availability';

  // The toggle flips the current flag; compute the resulting state for copy.
  const currentlySet = isAvailability
    ? (doctor?.available_for_appointment ?? false)
    : (doctor?.on_leave ?? false);

  // Resulting state drives the icon/color and the confirm label.
  const resultingOn = !currentlySet;
  const title = isAvailability
    ? resultingOn
      ? 'Mark Available'
      : 'Mark Unavailable'
    : resultingOn
      ? 'Mark On Leave'
      : 'Mark Back On Duty';

  const IconComponent = isAvailability
    ? resultingOn
      ? CalendarCheck
      : CalendarX
    : resultingOn
      ? CalendarOff
      : CalendarCheck;

  // Negative resulting states (unavailable / on leave) use danger tones;
  // positive ones use success — mirroring DoctorStatusDialog.
  const iconTone = isAvailability
    ? resultingOn
      ? 'bg-success/10 text-success'
      : 'bg-danger/10 text-danger'
    : resultingOn
      ? 'bg-warning/10 text-warning'
      : 'bg-success/10 text-success';

  // Availability: Mark Available = success / Mark Unavailable = danger.
  // Leave: Mark Back On Duty = success / Mark On Leave = danger.
  const confirmVariant = isAvailability
    ? resultingOn
      ? 'success'
      : 'danger'
    : resultingOn
      ? 'danger'
      : 'success';

  const name = doctor?.user_full_name ?? 'This doctor';

  const bodyCopy = isAvailability
    ? resultingOn
      ? `${name} will be marked available for new appointments.`
      : `${name} will be marked unavailable for new appointments.`
    : resultingOn
      ? `${name} will be marked on leave.`
      : `${name} will be marked back on duty.`;

  const detailCopy = isAvailability
    ? 'Availability is a simple toggle with no request body. Note: an inactive doctor cannot be marked available (the backend will reject it), and a doctor on leave remains effectively unavailable until taken off leave.'
    : 'Leave status is a simple toggle with no request body.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel={title}
    >
      <Modal.Header>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
            <Icon icon={IconComponent} size="md" />
          </span>
          <div>
            <h2 className="text-h4 font-semibold text-neutral-900">{title}</h2>
            <p className="mt-0.5 text-body-sm text-neutral-500">{doctor?.doctor_code}</p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-3">
            <p className="text-body-sm text-danger">{error}</p>
          </div>
        )}
        <p className="text-body text-neutral-700">{bodyCopy}</p>
        <p className="mt-3 text-body-sm text-neutral-500">
          {detailCopy} This action requires the ADMIN role.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant={confirmVariant}
          loading={submitting}
          onClick={onConfirm}
        >
          {title}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
