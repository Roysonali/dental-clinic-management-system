import type { FC } from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import type { PatientListItem, PatientResponse } from '../../types/patient';

export type PatientStatusIntent = 'deactivate' | 'reactivate';

interface PatientStatusDialogProps {
  /** Open state */
  open: boolean;
  /** The patient being acted on */
  patient: PatientListItem | PatientResponse | null;
  /** Which status change to confirm */
  intent: PatientStatusIntent | null;
  /** Show loading on the confirm button */
  submitting?: boolean;
  /** Error banner message (e.g. backend 403/400) */
  error?: string | null;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Called to close the dialog */
  onClose: () => void;
}

/**
 * PatientStatusDialog — confirmation for deactivate / reactivate.
 *
 * NOTE: the backend exposes NO hard-delete endpoint — patient lifecycle is
 * managed via activate/deactivate (soft deletion). This dialog covers the
 * full lifecycle. The PatientDeleteDialog concept from the spec is therefore
 * intentionally represented by the deactivate confirmation.
 */
export const PatientStatusDialog: FC<PatientStatusDialogProps> = ({
  open,
  patient,
  intent,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const isDeactivate = intent === 'deactivate';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel={isDeactivate ? 'Deactivate patient' : 'Reactivate patient'}
    >
      <Modal.Header>
        <div className="flex items-start gap-3">
          <span
            className={`
              mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full
              ${isDeactivate ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}
            `}
          >
            <Icon icon={isDeactivate ? UserX : UserCheck} size="md" />
          </span>
          <div>
            <h2 className="text-h4 font-semibold text-neutral-900">
              {isDeactivate ? 'Deactivate Patient' : 'Reactivate Patient'}
            </h2>
            <p className="mt-0.5 text-body-sm text-neutral-500">{patient?.patient_code}</p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-3">
            <p className="text-body-sm text-danger">{error}</p>
          </div>
        )}
        <p className="text-body text-neutral-700">
          {isDeactivate ? (
            <>
              <span className="font-semibold text-neutral-900">{patient?.full_name}</span> will be{' '}
              <span className="font-semibold text-danger">deactivated</span>. Deactivated patients
              are excluded from most searches and cannot be booked for new appointments until
              reactivated.
            </>
          ) : (
            <>
              <span className="font-semibold text-neutral-900">{patient?.full_name}</span> will be{' '}
              <span className="font-semibold text-success">reactivated</span> and will appear in
              searches again.
            </>
          )}
        </p>
        <p className="mt-3 text-body-sm text-neutral-500">
          This action requires the ADMIN role and updates the patient&apos;s active status.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant={isDeactivate ? 'danger' : 'success'}
          loading={submitting}
          onClick={onConfirm}
        >
          {isDeactivate ? 'Deactivate' : 'Reactivate'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
