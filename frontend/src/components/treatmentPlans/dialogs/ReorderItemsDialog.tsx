import { useState, type FC } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Alert } from '../../common/Alert/Alert';
import type { TreatmentPlanItemResponse } from '../../../types/treatmentPlan';

interface ReorderItemsDialogProps {
  open: boolean;
  items: TreatmentPlanItemResponse[];
  submitting?: boolean;
  error?: string | null;
  onConfirm: (orderedIds: string[]) => void;
  onClose: () => void;
}

/**
 * ReorderItemsDialog — S-04 reorder workflow
 * (PUT /treatment-plans/{id}/items/reorder, item_ids must contain every
 * item exactly once — backend 409 otherwise).
 *
 * Up/down buttons move the selected row; the confirm payload is the ordered
 * id list derived from the local array.
 */
export const ReorderItemsDialog: FC<ReorderItemsDialogProps> = ({
  open,
  items,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  // The container remounts this dialog per open (via `key`), so `order` is
  // initialised from the current items on mount — no effect-sync needed.
  const [order, setOrder] = useState<TreatmentPlanItemResponse[]>(items);

  const move = (index: number, delta: -1 | 1) => {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="md" ariaLabel="Reorder items">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">Reorder Items</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-4 text-body-sm text-neutral-500">
          Use the arrows to change the execution order. The backend requires every item exactly once.
        </p>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {order.map((item, index) => (
            <li key={item.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-800">
                <span className="font-mono text-neutral-400">{index + 1}.</span>{' '}
                {item.procedure?.name ?? `Procedure #${item.procedure_id}`}
                {item.tooth_number != null && (
                  <span className="text-neutral-400"> · #{item.tooth_number}</span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Move ${item.sequence_number} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <Icon icon={ArrowUp} size="sm" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Move ${item.sequence_number} down`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <Icon icon={ArrowDown} size="sm" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
        {error && <Alert variant="danger" className="mt-3" title="Could not reorder items" description={error} />}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={submitting}
          disabled={submitting || order.length === 0}
          onClick={() => onConfirm(order.map((item) => item.id))}
        >
          Save Order
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
