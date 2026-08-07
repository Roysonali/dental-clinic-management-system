import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';

interface PrescriptionDeleteConfirmProps {
  open: boolean;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Delete prescription confirmation (soft delete, idempotent). */
export const PrescriptionDeleteConfirm: FC<PrescriptionDeleteConfirmProps> = ({
  open,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Delete prescription">
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          Delete Prescription
        </h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-700">
          Delete this prescription and its medicines? It will be removed from
          the record.
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
