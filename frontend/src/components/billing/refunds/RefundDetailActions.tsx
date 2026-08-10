import type { FC } from 'react';
import { Ban, CheckCircle2, CircleCheckBig } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { PermissionGate } from '../../rbac/PermissionGate';
import { REFUND_WORKFLOW_ROLES } from '../../../constants/roles';
import { canTransitionTo } from '../../../utils/refundStateMachine';
import type { RefundStatus } from '../../../types/billing';

interface RefundDetailActionsProps {
  status: RefundStatus;
  submitting?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onComplete: () => void;
}

type RefundActionId = 'approve' | 'reject' | 'complete';

/**
 * RefundDetailActions — state-machine-driven refund lifecycle actions.
 *
 * Mirrors backend `REFUND_TRANSITIONS` + the router's exposed endpoints:
 * - PENDING  → Approve (primary) + Reject (destructive)
 * - APPROVED → Complete (primary)
 * - REJECTED / COMPLETED → none (terminal)
 *
 * Every action is role-gated via PermissionGate (`_REFUND_WORKFLOW_ROLES` —
 * admin, receptionist, doctors; dental assistant excluded). The backend
 * remains the final authority.
 */
export const RefundDetailActions: FC<RefundDetailActionsProps> = ({
  status,
  submitting = false,
  onApprove,
  onReject,
  onComplete,
}) => {
  const actions: { id: RefundActionId; label: string }[] = [];
  if (canTransitionTo(status, 'approved')) actions.push({ id: 'approve', label: 'Approve refund' });
  if (canTransitionTo(status, 'rejected')) actions.push({ id: 'reject', label: 'Reject refund' });
  if (canTransitionTo(status, 'completed')) actions.push({ id: 'complete', label: 'Complete refund' });

  if (actions.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-body-sm text-neutral-500">
        No actions are available for this refund status.
      </p>
    );
  }

  const actionButtons: Record<RefundActionId, React.ReactNode> = {
    approve: (
      <Button
        variant="primary"
        size="sm"
        onClick={onApprove}
        disabled={submitting}
        leftIcon={<Icon icon={CheckCircle2} size="xs" />}
      >
        Approve refund
      </Button>
    ),
    reject: (
      <Button
        variant="danger"
        size="sm"
        onClick={onReject}
        disabled={submitting}
        leftIcon={<Icon icon={Ban} size="xs" />}
      >
        Reject refund
      </Button>
    ),
    complete: (
      <Button
        variant="primary"
        size="sm"
        onClick={onComplete}
        disabled={submitting}
        leftIcon={<Icon icon={CircleCheckBig} size="xs" />}
      >
        Complete refund
      </Button>
    ),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <PermissionGate key={action.id} requiredRoles={REFUND_WORKFLOW_ROLES} mode="hide">
          {actionButtons[action.id]}
        </PermissionGate>
      ))}
    </div>
  );
};
