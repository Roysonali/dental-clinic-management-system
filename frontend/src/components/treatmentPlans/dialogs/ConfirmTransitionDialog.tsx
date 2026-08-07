import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Alert } from '../../common/Alert/Alert';
import { TREATMENT_PLAN_ACTION_LABELS } from '../../../constants/treatmentPlan';
import type { TreatmentPlanActionId } from '../../../types/treatmentPlan';

interface ConfirmTransitionDialogProps {
  open: boolean;
  /** The action being confirmed (null = closed). */
  action: TreatmentPlanActionId | null;
  planCode: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation copy per action (backend 409s illegal transitions anyway). */
const CONFIRM_COPY: Partial<Record<TreatmentPlanActionId, string>> = {
  'submit-for-review': 'Submit this plan for review? The plan must contain at least one item.',
  'approve-review': 'Approve this plan review? The plan moves to Proposed.',
  'reject-review': 'Reject this plan review? The plan returns to Draft.',
  accept: 'Accept this plan? The patient acknowledgment flow becomes available.',
  decline: 'Decline this plan? It moves to Rejected.',
  cancel: 'Cancel this plan? This is a terminal action and cannot be undone.',
  'start-treatment': 'Start treatment on this plan? It moves to In Progress.',
  hold: 'Put this plan on hold? It moves to On Hold.',
  resume: 'Resume this plan? It moves back to In Progress.',
  complete: 'Complete this plan? It moves to Completed (terminal).',
};

/**
 * ConfirmTransitionDialog — generic confirmation for every plan status
 * transition (A7–A20, [MAP §8]). The action id drives the copy and the
 * destructive styling (cancel/reject/decline are destructive).
 */
export const ConfirmTransitionDialog: FC<ConfirmTransitionDialogProps> = ({
  open,
  action,
  planCode,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const destructive =
    action === 'cancel' || action === 'decline' || action === 'reject-review';

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Confirm transition">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">
          {action ? TREATMENT_PLAN_ACTION_LABELS[action] : ''}
        </h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-600">
          {action ? CONFIRM_COPY[action] ?? `Perform "${TREATMENT_PLAN_ACTION_LABELS[action]}" on ${planCode}?` : ''}
        </p>
        {error && <Alert variant="danger" className="mt-3" title="Transition failed" description={error} />}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={submitting}
          disabled={submitting || !action}
        >
          Confirm
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
