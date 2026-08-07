import { useState, type FC } from 'react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { PatientRecordStatusBadge } from '../PatientRecordStatusBadge';
import { PATIENT_RECORD_STATUS_LABELS } from '../../../constants/patientRecord';
import {
  isAdminOnlyTransition,
  legalStatusTargets,
  RECORD_STATUS_TRANSITIONS,
  transitionRequiresChiefComplaint,
} from '../../../utils/patientRecordStateMachine';
import type { RecordStatus } from '../../../types/patientRecord';

interface ChangeStatusDialogProps {
  open: boolean;
  /** The record's current status. */
  currentStatus: RecordStatus;
  /** True when the record has a non-empty chief complaint (prerequisite). */
  hasChiefComplaint: boolean;
  /** True when the current user is a proven admin (ADMIN/CHIEF_DOCTOR). */
  isAdmin: boolean;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (target: RecordStatus) => void;
  onClose: () => void;
}

/**
 * ChangeStatusDialog — S-05 status transition dialog ([UI spec S-05]).
 *
 * The backend accepts ANY status value for status-change roles (BCR O1), so
 * this dialog hardcodes the intended transition matrix
 * (`patientRecordStateMachine`) and disables illegal moves with an
 * explanation. Only legal targets are selectable; the backend remains the
 * final authority.
 */
export const ChangeStatusDialog: FC<ChangeStatusDialogProps> = ({
  open,
  currentStatus,
  hasChiefComplaint,
  isAdmin,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const [selected, setSelected] = useState<RecordStatus | null>(null);

  // M-1: never carry a previously selected target into a fresh session.
  // React-documented render-time state adjustment (a setState in an effect
  // would add an unnecessary render pass and is lint-flagged).
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setSelected(null);
  }

  const targets = RECORD_STATUS_TRANSITIONS[currentStatus] ?? [];

  const targetState = (target: RecordStatus) => {
    const adminOnly = isAdminOnlyTransition(currentStatus, target) && !isAdmin;
    const missingComplaint =
      transitionRequiresChiefComplaint(currentStatus, target) && !hasChiefComplaint;
    const legal = !adminOnly && !missingComplaint;
    const reason = adminOnly
      ? 'Requires an admin (ADMIN or CHIEF_DOCTOR)'
      : missingComplaint
        ? 'Chief complaint is required first'
        : undefined;
    return { legal, reason };
  };

  const legalTargets = legalStatusTargets(currentStatus, isAdmin);

  const handleConfirm = () => {
    if (selected) onConfirm(selected);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel="Change record status"
    >
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">Change Status</h2>
        <p className="mt-0.5 text-caption text-neutral-500">
          Choose the next clinical state for this record.
        </p>
      </Modal.Header>

      <Modal.Body>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-body-sm text-neutral-500">Current status:</span>
          <PatientRecordStatusBadge status={currentStatus} size="sm" />
        </div>

        {targets.length === 0 ? (
          <p className="rounded-lg bg-neutral-50 p-3 text-body-sm text-neutral-600">
            This record is in a terminal state and cannot transition further.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Target status</legend>
            {targets.map((target) => {
              const { legal, reason } = targetState(target);
              return (
                <label
                  key={target}
                  className={`
                    flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150
                    ${legal ? 'border-neutral-200 hover:border-primary-300 hover:bg-primary-50/40' : 'cursor-not-allowed border-neutral-100 bg-neutral-50 opacity-60'}
                  `}
                >
                  <input
                    type="radio"
                    name="target-status"
                    value={target}
                    checked={selected === target}
                    disabled={!legal}
                    onChange={() => setSelected(target)}
                    className="mt-1 h-4 w-4 accent-primary-500"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-body-sm font-medium text-neutral-800">
                        {PATIENT_RECORD_STATUS_LABELS[target]}
                      </span>
                      <PatientRecordStatusBadge
                        status={target}
                        size="sm"
                      />
                    </span>
                    <span className="mt-0.5 block text-caption text-neutral-500">
                      {legal
                        ? transitionDescription(currentStatus, target)
                        : (reason ?? 'Not available')}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        {legalTargets.length === 0 && targets.length > 0 && (
          <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-body-sm text-neutral-600">
            No transitions are available for your role.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-body-sm text-danger">
            {error}
          </p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!selected}
          loading={submitting}
        >
          Update Status
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

/** One-line description of a transition for the dialog list. */
function transitionDescription(from: RecordStatus, to: RecordStatus): string {
  if (from === 'DRAFT' && to === 'IN_PROGRESS') return 'Start working on the record';
  if (from === 'IN_PROGRESS' && to === 'UNDER_REVIEW') return 'Submit for clinical review';
  if (from === 'IN_PROGRESS' && to === 'DRAFT') return 'Return to draft';
  if (from === 'UNDER_REVIEW' && to === 'COMPLETED') return 'Approve and complete the review';
  if (from === 'UNDER_REVIEW' && to === 'IN_PROGRESS') return 'Request revisions (admin)';
  if (from === 'COMPLETED' && to === 'FINALIZED') return 'Lock the record — becomes immutable';
  if (from === 'COMPLETED' && to === 'IN_PROGRESS') return 'Reopen the record (admin)';
  return `Move to ${PATIENT_RECORD_STATUS_LABELS[to]}`;
}
