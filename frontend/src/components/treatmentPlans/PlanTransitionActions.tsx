import type { FC } from 'react';
import {
  CheckCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
  ThumbsDown,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../common/Button/Button';
import { TREATMENT_PLAN_ACTION_LABELS } from '../../constants/treatmentPlan';
import {
  approvalActionsForSubState,
  isApprovalAction,
  planActionsForStatus,
} from '../../utils/treatmentPlanStateMachine';
import type {
  ApprovalResponse,
  TreatmentPlanActionId,
  TreatmentPlanStatus,
} from '../../types/treatmentPlan';

/** Icon per action for the action-bar buttons. */
const ACTION_ICONS: Record<TreatmentPlanActionId, LucideIcon> = {
  'submit-for-review': Send,
  'approve-review': CheckCircle,
  'reject-review': XCircle,
  accept: CheckCircle,
  decline: ThumbsDown,
  cancel: XCircle,
  'start-treatment': Play,
  hold: Pause,
  resume: RotateCcw,
  complete: CheckCircle,
  'doctor-approve': CheckCircle,
  'doctor-revoke': RotateCcw,
  'patient-acknowledge': CheckCircle,
  'patient-decline': ThumbsDown,
};

interface PlanTransitionActionsProps {
  status: TreatmentPlanStatus;
  /**
   * Approval record — gates the four approval actions by sub-state when
   * PROPOSED (doctor-approve while unsigned, revoke when signed, patient
   * buttons only when signed + pending). Mirrors ApprovalStatusCard.
   */
  approval?: ApprovalResponse | null;
  /** True while a transition mutation is in flight (buttons disabled). */
  submitting?: boolean;
  /** Called when the user triggers an action (opens its confirm dialog). */
  onAction: (action: TreatmentPlanActionId) => void;
  className?: string;
}

/**
 * PlanTransitionActions — the status-driven action bar (S-02).
 *
 * Renders exactly the endpoint-backed actions for the current status via
 * `planActionsForStatus` (state machine, O5) — never more. When the plan is
 * `proposed`, the four approval actions are additionally gated by the
 * approval record sub-state (`approvalActionsForSubState`) so the UI never
 * offers a call the backend would reject with 409 ([MAP §5.2], F-02).
 */
export const PlanTransitionActions: FC<PlanTransitionActionsProps> = ({
  status,
  approval = null,
  submitting = false,
  onAction,
  className = '',
}) => {
  const statusActions = planActionsForStatus(status);
  // PROPOSED: union the sub-state approval actions (doctor-approve OR
  // doctor-revoke + patient buttons — never both) with the status-driven
  // non-approval actions (accept / decline / cancel).
  const actions =
    status === 'proposed'
      ? [...approvalActionsForSubState(approval), ...statusActions.filter((action) => !isApprovalAction(action))]
      : statusActions;

  if (actions.length === 0) {
    return (
      <p className={`text-body-sm text-neutral-500 ${className}`}>
        No further actions are available for this plan.
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {actions.map((action) => {
        const IconComponent = ACTION_ICONS[action];
        const isDestructive =
          action === 'cancel' || action === 'decline' || action === 'reject-review' || action === 'patient-decline';
        return (
          <Button
            key={action}
            type="button"
            variant={isDestructive ? 'outline' : 'primary'}
            size="sm"
            disabled={submitting}
            onClick={() => onAction(action)}
            leftIcon={<IconComponent size={14} aria-hidden="true" />}
          >
            {TREATMENT_PLAN_ACTION_LABELS[action]}
          </Button>
        );
      })}
    </div>
  );
};
