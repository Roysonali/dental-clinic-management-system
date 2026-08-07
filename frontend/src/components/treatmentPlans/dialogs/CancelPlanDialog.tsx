import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Alert } from '../../common/Alert/Alert';

interface CancelPlanDialogProps {
  open: boolean;
  planCode: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * CancelPlanDialog — destructive cancel confirmation
 * (POST /treatment-plans/{id}/cancel; any non-terminal status).
 * Cancelled is terminal — the plan cannot be reactivated (O3/U3).
 */
export const CancelPlanDialog: FC<CancelPlanDialogProps> = ({
  open,
  planCode,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Cancel treatment plan">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">Cancel Treatment Plan</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-600">
          Cancel plan <span className="font-semibold text-neutral-900">{planCode}</span>? This is a
          terminal action — a cancelled plan cannot be reactivated or edited.
        </p>
        {error && <Alert variant="danger" className="mt-3" title="Could not cancel plan" description={error} />}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Keep Plan
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Cancel Plan
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
