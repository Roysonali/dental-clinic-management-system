import type { FC } from 'react';
import { PencilLine, Send, Trash2, XCircle } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { PermissionGate } from '../../rbac/PermissionGate';
import { ADMIN_ROLES } from '../../../constants/roles';
import { getInvoiceActions, type InvoiceActionId } from '../../../utils/invoiceStateMachine';
import type { InvoiceStatus } from '../../../types/billing';

interface InvoiceDetailActionsProps {
  status: InvoiceStatus;
  submitting?: boolean;
  onIssue: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

/**
 * InvoiceDetailActions — state-machine-driven lifecycle actions.
 *
 * Renders exactly the actions the backend permits for the invoice's status
 * (`getInvoiceActions`, mirroring INVOICE_TRANSITIONS + the router's exposed
 * endpoints). No Issue button on already-issued invoices, no actions on
 * terminal invoices. Delete is additionally ADMIN-gated via PermissionGate
 * (backend `_INVOICE_DELETE_ROLES`).
 */
export const InvoiceDetailActions: FC<InvoiceDetailActionsProps> = ({
  status,
  submitting = false,
  onIssue,
  onEdit,
  onCancel,
  onDelete,
}) => {
  const actions = getInvoiceActions(status);

  if (actions.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-body-sm text-neutral-500">
        No actions are available for this invoice status.
      </p>
    );
  }

  const actionButtons: Partial<Record<InvoiceActionId, React.ReactNode>> = {
    issue: (
      <Button
        variant="primary"
        size="sm"
        onClick={onIssue}
        disabled={submitting}
        leftIcon={<Icon icon={Send} size="xs" />}
      >
        Issue
      </Button>
    ),
    edit: (
      <Button
        variant="secondary"
        size="sm"
        onClick={onEdit}
        disabled={submitting}
        leftIcon={<Icon icon={PencilLine} size="xs" />}
      >
        Edit
      </Button>
    ),
    cancel: (
      <Button
        variant="secondary"
        size="sm"
        onClick={onCancel}
        disabled={submitting}
        leftIcon={<Icon icon={XCircle} size="xs" />}
        className="hover:border-danger/40 hover:text-danger"
      >
        Cancel
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
