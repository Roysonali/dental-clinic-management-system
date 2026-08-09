import type { FC } from 'react';
import { ArrowUpRight, Ban, CircleCheck, CircleX, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { PermissionGate } from '../../rbac/PermissionGate';
import { ADMIN_ROLES } from '../../../constants/roles';
import { getPaymentActions, type PaymentActionId } from '../../../utils/paymentStateMachine';
import type { PaymentRead } from '../../../types/billing';

interface PaymentDetailActionsProps {
  payment: PaymentRead;
  submitting?: boolean;
  onComplete: () => void;
  onFail: () => void;
  onVoid: () => void;
  onAllocate: () => void;
  onDelete: () => void;
  /** Opens the Create Refund drawer (completed payments with a refundable balance). */
  onRefund?: () => void;
}

/**
 * PaymentDetailActions — state-machine-driven lifecycle actions.
 *
 * Renders exactly the actions the backend permits for the payment's status
 * (`getPaymentActions`, mirroring PAYMENT_TRANSITIONS + the router's exposed
 * endpoints): a Pending payment shows Complete (primary) + Mark as failed /
 * Void (destructive), a Completed payment shows Allocate (secondary) and
 * Create refund (secondary), and terminal statuses show none. Allocate is
 * hidden when there is nothing left to allocate, and refund is hidden when
 * the refundable balance (total − refunded) is exhausted. Delete is
 * ADMIN-gated via PermissionGate (backend `_PAYMENT_DELETE_ROLES`).
 */
export const PaymentDetailActions: FC<PaymentDetailActionsProps> = ({
  payment,
  submitting = false,
  onComplete,
  onFail,
  onVoid,
  onAllocate,
  onDelete,
  onRefund,
}) => {
  const refundableBalance =
    Number(payment.total_amount) - Number(payment.financials.refunded_amount);

  const actions = getPaymentActions(payment.status).filter(
    // Allocate is only meaningful while there is a positive unallocated balance.
    (action) => action !== 'allocate' || Number(payment.financials.unallocated_amount) > 0,
  );

  if (onRefund && payment.status === 'completed' && refundableBalance > 0) {
    actions.push('refund');
  }

  if (actions.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-body-sm text-neutral-500">
        No actions are available for this payment status.
      </p>
    );
  }

  const actionButtons: Partial<Record<PaymentActionId, React.ReactNode>> = {
    complete: (
      <Button
        variant="primary"
        size="sm"
        onClick={onComplete}
        disabled={submitting}
        leftIcon={<Icon icon={CircleCheck} size="xs" />}
      >
        Complete
      </Button>
    ),
    allocate: (
      <Button
        variant="secondary"
        size="sm"
        onClick={onAllocate}
        disabled={submitting}
        leftIcon={<Icon icon={ArrowUpRight} size="xs" />}
      >
        Allocate
      </Button>
    ),
    refund: (
      <Button
        variant="secondary"
        size="sm"
        onClick={onRefund}
        disabled={submitting}
        leftIcon={<Icon icon={RotateCcw} size="xs" />}
      >
        Create refund
      </Button>
    ),
    fail: (
      <Button
        variant="danger"
        size="sm"
        onClick={onFail}
        disabled={submitting}
        leftIcon={<Icon icon={CircleX} size="xs" />}
      >
        Mark as failed
      </Button>
    ),
    void: (
      <Button
        variant="danger"
        size="sm"
        onClick={onVoid}
        disabled={submitting}
        leftIcon={<Icon icon={Ban} size="xs" />}
      >
        Void
      </Button>
    ),
    delete: (
      <Button
        variant="danger"
        size="sm"
        onClick={onDelete}
        disabled={submitting}
        leftIcon={<Icon icon={Trash2} size="xs" />}
      >
        Delete
      </Button>
    ),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) =>
        action === 'delete' ? (
          <PermissionGate key={action} requiredRoles={ADMIN_ROLES} mode="hide">
            {actionButtons[action]}
          </PermissionGate>
        ) : (
          <span key={action}>{actionButtons[action]}</span>
        ),
      )}
    </div>
  );
};
