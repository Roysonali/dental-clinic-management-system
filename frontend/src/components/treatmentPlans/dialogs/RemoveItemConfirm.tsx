import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Alert } from '../../common/Alert/Alert';
import type { TreatmentPlanItemResponse } from '../../../types/treatmentPlan';

interface RemoveItemConfirmProps {
  open: boolean;
  item: TreatmentPlanItemResponse | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * RemoveItemConfirm — S-04 destructive removal confirmation
 * (DELETE /treatment-plans/{id}/items/{itemId}, editable statuses only).
 */
export const RemoveItemConfirm: FC<RemoveItemConfirmProps> = ({
  open,
  item,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Remove plan item">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">Remove Item?</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-600">
          Remove item{' '}
          <span className="font-semibold text-neutral-900">
            {item ? `#${item.sequence_number}` : ''}
          </span>
          {item?.procedure ? ` (${item.procedure.name})` : ''} from this treatment plan?
          This cannot be undone.
        </p>
        {error && <Alert variant="danger" className="mt-3" title="Could not remove item" description={error} />}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Remove
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
