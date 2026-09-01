import type { FC } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import type { DoctorResponse } from '../../types/doctor';

interface DoctorScheduleRevertDialogProps {
  /** Open state */
  open: boolean;
  /** The doctor being reverted */
  doctor: DoctorResponse | null;
  /** Show loading on the confirm button */
  submitting?: boolean;
  /** Backend error message */
  error?: string | null;
  /** Called when the user confirms the revert */
  onConfirm: () => void;
  /** Called to close the dialog */
  onClose: () => void;
}

/**
 * DoctorScheduleRevertDialog — confirmation for reverting to clinic default schedule.
 *
 * Explains clearly what will happen and requires explicit confirmation.
 * Sends an empty PUT to the atomic replace endpoint.
 */
export const DoctorScheduleRevertDialog: FC<DoctorScheduleRevertDialogProps> = ({
  open,
  doctor,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-50">
            <Icon icon={RotateCcw} size="md" className="text-warning-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Revert to Clinic Default Schedule
            </h2>
            {doctor && (
              <p className="text-body-sm text-neutral-500">
                {doctor.user_full_name ?? doctor.doctor_code}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md bg-neutral-50 p-4 text-body-sm text-neutral-700">
          <p className="mb-2">
            This will <strong>remove the doctor&apos;s custom working schedule</strong>.
          </p>
          <p>
            The doctor will use the <strong>clinic default schedule</strong>:
          </p>
          <ul className="mt-2 list-inside list-disc text-neutral-600">
            <li>Monday – Saturday</li>
            <li>Morning: 10:00 AM – 1:00 PM</li>
            <li>Evening: 5:00 PM – 9:00 PM</li>
          </ul>
        </div>

        {error && (
          <div className="rounded-md bg-danger-50 p-3 text-body-sm text-danger-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} data-testid="cancel-revert">
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={submitting}
            data-testid="confirm-revert"
          >
            {submitting ? 'Reverting...' : 'Revert to Clinic Default'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
