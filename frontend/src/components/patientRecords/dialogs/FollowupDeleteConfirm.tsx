import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { formatISODate } from '../../../utils/date';

interface FollowupDeleteConfirmProps {
  open: boolean;
  followupDate: string | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Delete follow-up confirmation (soft delete, idempotent). */
export const FollowupDeleteConfirm: FC<FollowupDeleteConfirmProps> = ({
  open,
  followupDate,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Delete follow-up">
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">Delete Follow-up</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-700">
          Delete the follow-up scheduled for{' '}
          <span className="font-medium text-neutral-900">
            {followupDate ? formatISODate(followupDate) : 'this date'}
          </span>
          ?
        </p>
        {error && (
          <p role="alert" className="mt-3 text-body-sm text-danger">
            {error}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={submitting}>
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
