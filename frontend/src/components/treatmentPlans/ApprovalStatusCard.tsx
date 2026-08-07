import type { FC } from 'react';
import { CheckCircle2, RotateCcw, ThumbsDown, ThumbsUp, UserCheck, XCircle } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Button } from '../common/Button/Button';
import { Badge } from '../common/Badge/Badge';
import { Icon } from '../common/Icon/Icon';
import { approvalActionsForSubState } from '../../utils/treatmentPlanStateMachine';
import { formatISODate } from '../../utils/date';
import type { ApprovalResponse } from '../../types/treatmentPlan';

interface ApprovalStatusCardProps {
  approval: ApprovalResponse | null;
  /** Plan status — PROPOSED gates the action buttons (backend 409 otherwise). */
  isProposed: boolean;
  submitting?: boolean;
  onDoctorApprove: () => void;
  onDoctorRevoke: () => void;
  onPatientAcknowledge: () => void;
  onPatientDecline: () => void;
  className?: string;
}

/**
 * ApprovalStatusCard — S-06 doctor approval + patient acknowledgment cards
 * ([MAP §3.6]).
 *
 * Button visibility follows the backend gating (O7/O12, [BCR §11.2]):
 * - Doctor approve → PROPOSED + unsigned
 * - Doctor revoke → PROPOSED + signed
 * - Patient accept/decline → PROPOSED + signed + patient pending
 * The backend is the final authority — illegal calls 409 with an inline
 * message in the dialog.
 */
export const ApprovalStatusCard: FC<ApprovalStatusCardProps> = ({
  approval,
  isProposed,
  submitting = false,
  onDoctorApprove,
  onDoctorRevoke,
  onPatientAcknowledge,
  onPatientDecline,
  className = '',
}) => {
  // Single source of truth for the approval sub-state gating — the same
  // helper drives the header action bar (F-02), so the two surfaces cannot
  // drift. `doctor-revoke` is legal exactly when the doctor has signed;
  // patient actions are legal only when signed AND the patient is pending.
  const legalActions = approvalActionsForSubState(approval);
  const doctorSigned = legalActions.includes('doctor-revoke');
  const patientActAvailable = legalActions.includes('patient-acknowledge');
  const patientState = approval?.patient_status ?? 'pending';

  return (
    <div className={`grid grid-cols-1 gap-4 lg:grid-cols-2 ${className}`}>
      {/* Doctor approval */}
      <Card>
        <Card.Header
          title="Doctor Approval"
          subtitle={doctorSigned ? `Approved ${formatISODate(approval?.approved_at)}` : 'Not yet approved'}
          actions={
            doctorSigned ? (
              <Badge variant="success" size="sm">Approved</Badge>
            ) : (
              <Badge variant="warning" size="sm">Pending</Badge>
            )
          }
        />
        <Card.Body>
          <div className="flex flex-wrap gap-2">
            {!doctorSigned ? (
              <Button
                variant="primary"
                size="sm"
                disabled={!isProposed || submitting}
                onClick={onDoctorApprove}
                leftIcon={<Icon icon={UserCheck} size="xs" />}
              >
                Approve
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={!isProposed || submitting}
                onClick={onDoctorRevoke}
                leftIcon={<Icon icon={RotateCcw} size="xs" />}
              >
                Revoke Approval
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Patient acknowledgment */}
      <Card>
        <Card.Header
          title="Patient Acknowledgment"
          subtitle={
            patientState === 'pending'
              ? 'Waiting for patient'
              : patientState === 'accepted'
                ? `Acknowledged ${formatISODate(approval?.patient_acknowledged_at)}`
                : `Patient ${patientState.replace(/_/g, ' ')}`
          }
          actions={
            patientState === 'accepted' ? (
              <Badge variant="success" size="sm">
                <CheckCircle2 size={12} className="mr-0.5" /> Accepted
              </Badge>
            ) : patientState === 'rejected' ? (
              <Badge variant="danger" size="sm">Declined</Badge>
            ) : (
              <Badge variant="warning" size="sm">Pending</Badge>
            )
          }
        />
        <Card.Body>
          {patientState === 'pending' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={!patientActAvailable || !isProposed || submitting}
                onClick={onPatientAcknowledge}
                leftIcon={<Icon icon={ThumbsUp} size="xs" />}
              >
                Patient Accepts
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!patientActAvailable || !isProposed || submitting}
                onClick={onPatientDecline}
                leftIcon={<Icon icon={ThumbsDown} size="xs" />}
              >
                Patient Declines
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-body-sm text-neutral-500">
              <Icon
                icon={patientState === 'accepted' ? CheckCircle2 : XCircle}
                size="sm"
                className={patientState === 'accepted' ? 'text-success' : 'text-danger'}
              />
              {patientState === 'accepted' ? 'Plan acknowledged by the patient.' : 'The patient declined this plan.'}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};
