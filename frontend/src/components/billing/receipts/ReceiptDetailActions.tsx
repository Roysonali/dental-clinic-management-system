import type { FC } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { PermissionGate } from '../../rbac/PermissionGate';
import { RECEIPT_WORKFLOW_ROLES } from '../../../constants/roles';
import type { ReceiptStatus } from '../../../types/billing';

interface ReceiptDetailActionsProps {
  status: ReceiptStatus;
  submitting?: boolean;
  onRegenerate: () => void;
}

/**
 * ReceiptDetailActions — state-machine-driven receipt actions.
 *
 * The backend permits regeneration ONLY for receipts in GENERATED status
 * (validate_regeneratable — a cancelled receipt is terminal), and only for
 * the `_RECEIPT_WORKFLOW_ROLES` (admin, receptionist, doctors — dental
 * assistant excluded). So the button renders only for GENERATED receipts
 * and is role-gated via PermissionGate; the backend remains the authority.
 */
export const ReceiptDetailActions: FC<ReceiptDetailActionsProps> = ({
  status,
  submitting = false,
  onRegenerate,
}) => {
  if (status !== 'generated') {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-body-sm text-neutral-500">
        No actions are available for this receipt status.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PermissionGate requiredRoles={RECEIPT_WORKFLOW_ROLES} mode="hide">
        <Button
          variant="primary"
          size="sm"
          onClick={onRegenerate}
          disabled={submitting}
          leftIcon={<Icon icon={RefreshCw} size="xs" />}
        >
          Regenerate receipt
        </Button>
      </PermissionGate>
    </div>
  );
};
