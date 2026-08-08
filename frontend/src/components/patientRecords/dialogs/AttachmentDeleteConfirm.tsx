import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';

interface AttachmentDeleteConfirmProps {
  open: boolean;
  fileName: string | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Delete attachment metadata confirmation (soft delete, idempotent). */
export const AttachmentDeleteConfirm: FC<AttachmentDeleteConfirmProps> = ({
  open,
  fileName,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Delete attachment">
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          Delete Attachment
        </h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-700">
          Remove{' '}
          <span className="font-medium text-neutral-900">{fileName ?? 'this attachment'}</span>?
          Only the metadata record is removed — the file itself is untouched.
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
