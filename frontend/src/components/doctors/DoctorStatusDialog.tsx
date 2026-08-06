import type { FC } from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import type { DoctorResponse } from '../../types/doctor';

export type DoctorStatusIntent = 'deactivate' | 'activate';

interface DoctorStatusDialogProps {
  /** Open state */
  open: boolean;
  /** The doctor being acted on */
  doctor: DoctorResponse | null;
  /** Which status change to confirm */
  intent: DoctorStatusIntent | null;
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
 * DoctorStatusDialog — confirmation for activate / deactivate.
 * Reuses the Patient confirmation-dialog pattern; surfaces backend
 * errors (400 already-active/inactive, 403) via the existing error
 * handling (`parseApiError` messages passed in as `error`).
 */
export const DoctorStatusDialog: FC<DoctorStatusDialogProps> = ({
  open,
  doctor,
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
      ariaLabel={isDeactivate ? 'Deactivate doctor' : 'Activate doctor'}
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
              {isDeactivate ? 'Deactivate Doctor' : 'Activate Doctor'}
            </h2>
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
        <p className="text-body text-neutral-700">
          {isDeactivate ? (
            <>
              <span className="font-semibold text-neutral-900">
                {doctor?.user_full_name ?? 'This doctor'}
              </span>{' '}
              will be <span className="font-semibold text-danger">deactivated</span>. Deactivated
              doctors are excluded from most searches and cannot accept new appointments until
              reactivated.
            </>
          ) : (
            <>
              <span className="font-semibold text-neutral-900">
                {doctor?.user_full_name ?? 'This doctor'}
              </span>{' '}
              will be <span className="font-semibold text-success">activated</span> and will appear
              in searches again.
            </>
          )}
        </p>
        <p className="mt-3 text-body-sm text-neutral-500">
          This action requires the ADMIN role and updates the doctor&apos;s active status.
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
          {isDeactivate ? 'Deactivate' : 'Activate'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
