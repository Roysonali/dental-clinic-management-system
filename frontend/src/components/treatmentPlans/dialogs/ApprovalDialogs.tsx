import type { FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Alert } from '../../common/Alert/Alert';

interface ApprovalDialogProps {
  open: boolean;
  planCode: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

interface ApprovalDialogSpec {
  title: string;
  body: string;
  confirmText: string;
  destructive?: boolean;
}

const SPECS: Record<'doctorApprove' | 'doctorRevoke' | 'patientAcknowledge' | 'patientDecline', ApprovalDialogSpec> = {
  doctorApprove: {
    title: 'Doctor Approve Plan',
    body: 'Record the doctor’s approval for this plan? The plan then awaits patient acknowledgment.',
    confirmText: 'Approve',
  },
  doctorRevoke: {
    title: 'Revoke Doctor Approval',
    body: 'Withdraw the doctor’s approval? The plan returns to pending doctor approval.',
    confirmText: 'Revoke',
    destructive: true,
  },
  patientAcknowledge: {
    title: 'Patient Accepts Plan',
    body: 'Record the patient’s acceptance of this plan?',
    confirmText: 'Accept',
  },
  patientDecline: {
    title: 'Patient Declines Plan',
    body: 'Record the patient’s decline? The plan keeps its current status; the acknowledgment is marked declined.',
    confirmText: 'Decline',
    destructive: true,
  },
};

/**
 * Shared confirmation dialog for the four approval endpoints
 * (doctor-approve / doctor-revoke / patient-acknowledge / patient-decline).
 * Backend gating (O7): all require PROPOSED; approve requires unsigned,
 * revoke requires signed, patient actions require signed + pending — illegal
 * calls surface as 409 here ([MAP §8]).
 */
const ApprovalConfirmDialog: FC<ApprovalDialogProps & { spec: ApprovalDialogSpec }> = ({
  open,
  planCode,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
  spec,
}) => (
  <Modal open={open} onClose={onClose} size="sm" ariaLabel={spec.title}>
    <Modal.Header>
      <h2 className="text-h4 font-semibold text-neutral-900">{spec.title}</h2>
    </Modal.Header>
    <Modal.Body>
      <p className="text-body text-neutral-600">
        {spec.body} <span className="font-semibold text-neutral-900">{planCode}</span>
      </p>
      {error && <Alert variant="danger" className="mt-3" title="Action failed" description={error} />}
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onClose} disabled={submitting}>
        Cancel
      </Button>
      <Button
        variant={spec.destructive ? 'danger' : 'primary'}
        onClick={onConfirm}
        loading={submitting}
        disabled={submitting}
      >
        {spec.confirmText}
      </Button>
    </Modal.Footer>
  </Modal>
);

/** POST /treatment-plans/{id}/doctor-approve (PROPOSED + unsigned). */
export const DoctorApproveDialog: FC<ApprovalDialogProps> = (props) => (
  <ApprovalConfirmDialog {...props} spec={SPECS.doctorApprove} />
);

/** POST /treatment-plans/{id}/doctor-revoke (PROPOSED + signed). */
export const DoctorRevokeDialog: FC<ApprovalDialogProps> = (props) => (
  <ApprovalConfirmDialog {...props} spec={SPECS.doctorRevoke} />
);

/** POST /treatment-plans/{id}/patient-acknowledge (PROPOSED + signed + pending). */
export const PatientAcknowledgeDialog: FC<ApprovalDialogProps> = (props) => (
  <ApprovalConfirmDialog {...props} spec={SPECS.patientAcknowledge} />
);

/** POST /treatment-plans/{id}/patient-decline (PROPOSED + signed + pending). */
export const PatientDeclineDialog: FC<ApprovalDialogProps> = (props) => (
  <ApprovalConfirmDialog {...props} spec={SPECS.patientDecline} />
);
