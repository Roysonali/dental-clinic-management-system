import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Alert } from '../../common/Alert/Alert';

interface RestoreVersionDialogProps {
  open: boolean;
  versionNumber: number | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * RestoreVersionDialog — destructive restore confirmation
 * (POST /treatment-plans/{id}/versions/{versionId}/restore; editable statuses
 * only — the caller gates the trigger via `isEditableStatus`).
 * Restoring replaces the CURRENT items with the snapshot's items.
 */
export const RestoreVersionDialog: FC<RestoreVersionDialogProps> = ({
  open,
  versionNumber,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Restore version">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">Restore Version {versionNumber ?? ''}?</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-600">
          Restoring version {versionNumber ?? ''} replaces the current plan items with the items
          captured in that snapshot. Current items will be lost.
        </p>
        {error && <Alert variant="danger" className="mt-3" title="Could not restore version" description={error} />}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={submitting} disabled={submitting || versionNumber == null}>
          Restore
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
