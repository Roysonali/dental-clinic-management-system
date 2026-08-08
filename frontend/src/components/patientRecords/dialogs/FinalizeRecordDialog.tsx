import { useState, type FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Alert } from '../../common/Alert/Alert';
import { Checkbox } from '../../common/Checkbox/Checkbox';

interface FinalizeRecordDialogProps {
  open: boolean;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * FinalizeRecordDialog — S-06 finalize confirmation ([UI spec S-06]).
 *
 * Finalizing locks the record: status → FINALIZED, is_finalized → true, and
 * every future mutation (record + children) is rejected by the backend with
 * 400. The API requires the literal body `{confirm: true}`, mirrored here as
 * an explicit "I understand" checkbox that gates the confirm button.
 */
export const FinalizeRecordDialog: FC<FinalizeRecordDialogProps> = ({
  open,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const [understood, setUnderstood] = useState(false);

  // M-1: the confirmation checkbox must never persist across sessions.
  // React-documented render-time state adjustment (a setState in an effect
  // would add an unnecessary render pass and is lint-flagged).
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setUnderstood(false);
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Finalize patient record">
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          Finalize Patient Record
        </h2>
      </Modal.Header>

      <Modal.Body>
        <Alert
          variant="warning"
          className="mb-4"
          title="This action locks the record"
          description="Finalizing makes the record immutable. Clinical content and all diagnoses, prescriptions, follow-ups, and attachments can no longer be changed. This cannot be undone."
        />
        <Checkbox
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          label="I understand — finalize this record"
        />
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
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={!understood}
          loading={submitting}
        >
          Finalize Record
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
