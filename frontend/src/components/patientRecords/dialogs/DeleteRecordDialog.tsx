import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Alert } from '../../common/Alert/Alert';

interface DeleteRecordDialogProps {
  open: boolean;
  patientName: string | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * DeleteRecordDialog — S-07 record delete confirmation ([UI spec S-07]).
 *
 * Soft-deletes the record (ADMIN only — the backend 403s everyone else and
 * 400s finalized records). After deletion the record is hidden from all
 * lists; there is no restore endpoint.
 */
export const DeleteRecordDialog: FC<DeleteRecordDialogProps> = ({
  open,
  patientName,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Delete patient record">
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          Delete Patient Record
        </h2>
      </Modal.Header>

      <Modal.Body>
        <Alert
          variant="danger"
          className="mb-4"
          title="Delete this record?"
          description={
            patientName
              ? `The clinical record for ${patientName} will be hidden from all lists. This action cannot be undone.`
              : 'This clinical record will be hidden from all lists. This action cannot be undone.'
          }
        />
        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={submitting}>
          Delete Record
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
