import type { FC } from 'react';
import { CheckCircle2, CircleSlash } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { PermissionGate } from '../../rbac/PermissionGate';
import { CREDIT_NOTE_WORKFLOW_ROLES } from '../../../constants/roles';
import { canTransitionTo } from '../../../utils/creditNoteStateMachine';
import type { CreditNoteStatus } from '../../../types/billing';

interface CreditNoteDetailActionsProps {
  status: CreditNoteStatus;
  submitting?: boolean;
  onIssue?: () => void;
  onApply?: () => void;
  onVoid?: () => void;
}

type CreditNoteActionId = 'issue' | 'apply' | 'void';

export const CreditNoteDetailActions: FC<CreditNoteDetailActionsProps> = ({
  status,
  submitting = false,
  onIssue,
  onApply,
  onVoid,
}) => {
  const actions: { id: CreditNoteActionId; label: string }[] = [];

  if (canTransitionTo(status, 'issued') && onIssue) {
    actions.push({ id: 'issue', label: 'Issue' });
  }
  if (canTransitionTo(status, 'applied') && onApply) {
    actions.push({ id: 'apply', label: 'Apply credit note' });
  }
  if (canTransitionTo(status, 'void') && onVoid) {
    actions.push({ id: 'void', label: 'Void' });
  }

  if (actions.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-body-sm text-neutral-500">
        No actions are available for this credit note status.
      </p>
    );
  }

  const actionButtons: Record<CreditNoteActionId, React.ReactNode> = {
    issue: (
      <Button
        variant="primary"
        size="sm"
        onClick={onIssue}
        disabled={submitting}
        leftIcon={<Icon icon={CheckCircle2} size="xs" />}
      >
        Issue
      </Button>
    ),
    apply: (
      <Button
        variant="primary"
        size="sm"
        onClick={onApply}
        disabled={submitting}
        leftIcon={<Icon icon={CheckCircle2} size="xs" />}
      >
        Apply credit note
      </Button>
    ),
    void: (
      <Button
        variant="danger"
        size="sm"
        onClick={onVoid}
        disabled={submitting}
        leftIcon={<Icon icon={CircleSlash} size="xs" />}
      >
        Void
      </Button>
    ),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <PermissionGate key={action.id} requiredRoles={CREDIT_NOTE_WORKFLOW_ROLES} mode="hide">
          {actionButtons[action.id]}
        </PermissionGate>
      ))}
    </div>
  );
};
