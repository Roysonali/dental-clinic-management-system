import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';

interface DiagnosisDeleteConfirmProps {
  open: boolean;
  diagnosisName: string | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Delete diagnosis confirmation (soft delete, idempotent). */
export const DiagnosisDeleteConfirm: FC<DiagnosisDeleteConfirmProps> = ({
  open,
  diagnosisName,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Delete diagnosis">
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">Delete Diagnosis</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-700">
          Delete{' '}
          <span className="font-medium text-neutral-900">{diagnosisName ?? 'this diagnosis'}</span>
          ? It will be removed from the record.
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
