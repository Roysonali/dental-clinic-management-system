/**
 * Treatment Plan state machine — the single source of truth for status
 * legality on the frontend.
 *
 * The backend exposes NO allowed-transitions endpoint (O5), so the map in
 * `PLAN_TRANSITIONS` (backend `constants.py`) is hardcoded here and must be
 * kept in sync with the backend. Every action rendered by the UI flows
 * through `planActionsForStatus`; the backend remains the final authority
 * (illegal transitions → 409).
 *
 * The map intentionally lists only ENDPOINT-BACKED transitions: the
 * state-machine-legal but endpointless `proposed→draft` / `rejected→draft`
 * edges (O12) are excluded, which is why the constant is named
 * `ENDPOINT_BACKED_TRANSITIONS` rather than a generic allowed-transitions map.
 *
 * Verified against the backend contract review [BCR §11.1]:
 * - endpoint-backed transitions only (no `proposed→draft` / `rejected→draft`
 *   — those are legal in the state machine but have NO endpoint, O12).
 */
import type {
  ApprovalResponse,
  TreatmentPlanActionId,
  TreatmentPlanStatus,
} from '../types/treatmentPlan';

/**
 * Endpoint-backed plan transitions (backend `PLAN_TRANSITIONS` minus the
 * O12 edges that have no endpoint — proposed→draft / rejected→draft).
 */
export const ENDPOINT_BACKED_TRANSITIONS: Record<
  TreatmentPlanStatus,
  readonly TreatmentPlanStatus[]
> = {
  draft: ['under_review', 'cancelled'],
  under_review: ['proposed', 'draft', 'cancelled'],
  proposed: ['accepted', 'cancelled', 'rejected'],
  rejected: ['cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/** Statuses in which plan items may be added/updated/removed/reordered (409 otherwise). */
const EDITABLE_STATUSES: readonly TreatmentPlanStatus[] = [
  'draft',
  'under_review',
  'proposed',
];

/** True when items may be edited in this status (backend `validate_editable`). */
export function isEditableStatus(status: TreatmentPlanStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/** Terminal statuses — no further transitions (including cancel). */
export function terminalStatuses(): readonly TreatmentPlanStatus[] {
  return ['completed', 'cancelled'];
}

/** True when no endpoint-backed transition remains for this status. */
export function isTerminalStatus(status: TreatmentPlanStatus): boolean {
  return terminalStatuses().includes(status);
}

/** Action id → endpoint suffix (POST /treatment-plans/{id}/<suffix>, no body). */
export const TRANSITION_ENDPOINT: Record<TreatmentPlanActionId, string> = {
  'submit-for-review': 'submit-for-review',
  'approve-review': 'approve-review',
  'reject-review': 'reject-review',
  accept: 'accept',
  decline: 'decline',
  cancel: 'cancel',
  'start-treatment': 'start-treatment',
  hold: 'hold',
  resume: 'resume',
  complete: 'complete',
  'doctor-approve': 'doctor-approve',
  'doctor-revoke': 'doctor-revoke',
  'patient-acknowledge': 'patient-acknowledge',
  'patient-decline': 'patient-decline',
};

/** The four approval-record actions (not status transitions). */
export const APPROVAL_ACTIONS: readonly TreatmentPlanActionId[] = [
  'doctor-approve',
  'doctor-revoke',
  'patient-acknowledge',
  'patient-decline',
];

/** True when the action id is one of the four approval-record actions. */
export function isApprovalAction(action: TreatmentPlanActionId): boolean {
  return APPROVAL_ACTIONS.includes(action);
}

/**
 * Approval actions legal for a given approval record sub-state — mirrors
 * the backend gating ([BCR §11.2], same surface as ApprovalStatusCard):
 * - doctor-approve  → PROPOSED + unsigned (`approved_at` null)
 * - doctor-revoke   → PROPOSED + signed
 * - patient-acknowledge / patient-decline → PROPOSED + signed + patient pending
 *
 * Plan `accept` / `decline` are NOT gated here — the backend only requires
 * PROPOSED for those (verified in `accept_plan`/`decline_plan`).
 */
export function approvalActionsForSubState(
  approval: ApprovalResponse | null,
): readonly TreatmentPlanActionId[] {
  const doctorSigned = approval != null && approval.approved_at != null;
  const patientPending = approval?.patient_status === 'pending';
  const actions: TreatmentPlanActionId[] = [];
  if (!doctorSigned) {
    actions.push('doctor-approve');
  } else {
    actions.push('doctor-revoke');
    if (patientPending) actions.push('patient-acknowledge', 'patient-decline');
  }
  return actions;
}

/**
 * Status-driven actions the UI may offer for a plan status.
 *
 * When PROPOSED this includes the three always-offerable approval-record
 * actions (doctor-approve, patient-acknowledge, patient-decline) — NOT
 * doctor-revoke, which the caller unions in from
 * `approvalActionsForSubState` when the doctor has signed. Item-status
 * actions are intentionally absent (O2 — no endpoint).
 */
export function planActionsForStatus(
  status: TreatmentPlanStatus,
): readonly TreatmentPlanActionId[] {
  switch (status) {
    case 'draft':
      return ['submit-for-review', 'cancel'];
    case 'under_review':
      return ['approve-review', 'reject-review', 'cancel'];
    case 'proposed':
      return [
        'doctor-approve',
        'patient-acknowledge',
        'patient-decline',
        'accept',
        'decline',
        'cancel',
      ];
    case 'rejected':
      // Correction path is cancel → create new plan (no rejected→draft endpoint, O12).
      return ['cancel'];
    case 'accepted':
      return ['start-treatment', 'cancel'];
    case 'in_progress':
      return ['hold', 'complete', 'cancel'];
    case 'on_hold':
      return ['resume', 'complete', 'cancel'];
    case 'completed':
    case 'cancelled':
      return [];
  }
}
